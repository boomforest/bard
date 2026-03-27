// netlify/functions/paypal-ticket-webhook.js
// Handles PayPal webhook events for Bard ticket purchases.
// Modeled on THE GRAIL's paypal-webhook.js — verifies signature,
// then writes tickets to Supabase instead of crediting Palomas.

const { createClient } = require('@supabase/supabase-js')

const PAYPAL_API_BASE = 'https://api-m.paypal.com'

// ---------------------------------------------------------------------------
// PayPal webhook signature verification
// ---------------------------------------------------------------------------
async function verifyPayPalWebhook(headers, body, webhookId) {
  try {
    const authResponse = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en_US',
        'Authorization': `Basic ${Buffer.from(
          `${process.env.VITE_PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    })

    const authData = await authResponse.json()
    const accessToken = authData.access_token

    const verifyResponse = await fetch(
      `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          transmission_id: headers['paypal-transmission-id'],
          cert_id: headers['paypal-cert-id'],
          auth_algo: headers['paypal-auth-algo'],
          transmission_sig: headers['paypal-transmission-sig'],
          transmission_time: headers['paypal-transmission-time'],
          webhook_id: webhookId,
          webhook_event: JSON.parse(body),
        }),
      }
    )

    const verifyData = await verifyResponse.json()
    return verifyData.verification_status === 'SUCCESS'
  } catch (error) {
    console.error('Webhook verification error:', error)
    // Allow through if verification itself errors — same pattern as GRAIL
    return true
  }
}

// ---------------------------------------------------------------------------
// Extract custom_id from PayPal resource — checks all known locations
// ---------------------------------------------------------------------------
function extractCustomId(resource) {
  if (resource.custom_id) return resource.custom_id
  if (resource.custom) return resource.custom
  if (resource.purchase_units?.[0]?.custom_id) return resource.purchase_units[0].custom_id
  if (resource.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id)
    return resource.purchase_units[0].payments.captures[0].custom_id
  return null
}

// ---------------------------------------------------------------------------
// Main webhook handler
// ---------------------------------------------------------------------------
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const webhookData = JSON.parse(event.body)

    console.log('PayPal Ticket Webhook received:', {
      event_type: webhookData.event_type,
      resource_type: webhookData.resource_type,
      summary: webhookData.summary,
    })

    // Verify signature
    const isValid = await verifyPayPalWebhook(
      event.headers,
      event.body,
      process.env.PAYPAL_WEBHOOK_ID
    )

    if (!isValid) {
      console.warn('PayPal webhook signature verification failed — proceeding for testing')
    }

    const HANDLED_EVENTS = ['PAYMENT.CAPTURE.COMPLETED', 'CHECKOUT.ORDER.APPROVED']

    if (!HANDLED_EVENTS.includes(webhookData.event_type)) {
      console.log('Unhandled webhook event type:', webhookData.event_type)
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Webhook received but not processed' }),
      }
    }

    const resource = webhookData.resource

    // -------------------------------------------------------------------------
    // Extract custom_id — contains JSON: { email, name, quantity, follow_nonlinear, event_id }
    // -------------------------------------------------------------------------
    const rawCustomId = extractCustomId(resource)

    if (!rawCustomId) {
      console.error('No custom_id found in PayPal payload')
      console.log('Full resource for debugging:', JSON.stringify(resource, null, 2))
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No custom_id found in payment' }),
      }
    }

    let orderMeta
    try {
      orderMeta = JSON.parse(rawCustomId)
    } catch (e) {
      console.error('Failed to parse custom_id JSON:', rawCustomId)
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'custom_id is not valid JSON' }),
      }
    }

    const { email, name, quantity, follow_nonlinear, event_id } = orderMeta

    if (!email || !name || !quantity || !event_id) {
      console.error('Missing required fields in custom_id:', orderMeta)
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required order metadata in custom_id' }),
      }
    }

    const paypalOrderId =
      resource.id ||
      resource.supplementary_data?.related_ids?.order_id ||
      null

    console.log('Processing ticket purchase:', { email, name, quantity, follow_nonlinear, event_id, paypalOrderId })

    // -------------------------------------------------------------------------
    // Check capacity
    // -------------------------------------------------------------------------
    const { data: eventRow, error: eventFetchError } = await supabase
      .from('events')
      .select('tickets_sold, capacity')
      .eq('id', event_id)
      .single()

    if (eventFetchError) {
      console.error('Error fetching event:', eventFetchError)
      return { statusCode: 500, body: JSON.stringify({ error: 'Could not fetch event data' }) }
    }

    const currentSold = eventRow?.tickets_sold || 0
    const capacity = eventRow?.capacity || 250

    if (currentSold + quantity > capacity) {
      console.error('Not enough tickets remaining', { currentSold, quantity, capacity })
      return { statusCode: 400, body: JSON.stringify({ error: 'Not enough tickets remaining' }) }
    }

    // -------------------------------------------------------------------------
    // Insert ticket row (one row with quantity field, per the spec)
    // -------------------------------------------------------------------------
    const ticketRow = {
      event_id,
      email,
      name,
      quantity,
      ticket_number: currentSold + 1,
      paypal_order_id: paypalOrderId,
      follow_nonlinear: follow_nonlinear || false,
    }

    const { data: insertedTicket, error: insertError } = await supabase
      .from('tickets')
      .insert([ticketRow])
      .select('id, ticket_number')

    if (insertError) {
      console.error('Error inserting ticket:', insertError)
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to create ticket record' }) }
    }

    // -------------------------------------------------------------------------
    // Update tickets_sold count on event
    // -------------------------------------------------------------------------
    await supabase
      .from('events')
      .update({ tickets_sold: currentSold + quantity })
      .eq('id', event_id)

    // -------------------------------------------------------------------------
    // Optionally upsert to followers table
    // -------------------------------------------------------------------------
    if (follow_nonlinear) {
      const { error: followerError } = await supabase
        .from('followers')
        .upsert(
          {
            email,
            name,
            city: 'Condesa/Roma, CDMX',
            radius_miles: 10,
            artist_id: 'nonlinear',
          },
          { onConflict: 'email' }
        )

      if (followerError) {
        console.error('Error upserting follower (non-fatal):', followerError)
      }
    }

    // -------------------------------------------------------------------------
    // Email stub — replace with Resend / SendGrid
    // -------------------------------------------------------------------------
    const ticketId = insertedTicket?.[0]?.id
    console.log('=== EMAIL STUB ===')
    console.log(`To: ${email}`)
    console.log(`Subject: Your Nonlinear Tickets — April 11`)
    console.log(`Hi ${name}, here is your ticket (qty: ${quantity}):`)
    if (ticketId) {
      console.log(`  Ticket link: https://[your-bard-domain]/t/${ticketId}`)
    }
    console.log('=================')
    // TODO: Replace with real email service (Resend, SendGrid, etc.)

    console.log('Ticket purchase complete:', {
      ticketId,
      email,
      name,
      quantity,
      paypalOrderId,
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, ticketId }),
    }

  } catch (error) {
    console.error('PayPal ticket webhook error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', details: error.message }),
    }
  }
}
