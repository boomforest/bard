const Stripe  = require('stripe')
const { createClient } = require('@supabase/supabase-js')

// Verifies a successful PaymentIntent with Stripe, then writes tickets to
// Supabase and increments ticket_tiers.sold. Idempotent on payment_intent_id.
//
// POST body: { payment_intent_id }
// Response:  { tickets: [{ id, ticket_number }], event_slug }

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { payment_intent_id } = JSON.parse(event.body || '{}')
    if (!payment_intent_id) throw new Error('payment_intent_id required')

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    const pi = await stripe.paymentIntents.retrieve(payment_intent_id)
    if (!pi) throw new Error('Payment not found')
    if (pi.status !== 'succeeded' && pi.status !== 'processing') {
      throw new Error(`Payment not complete (status: ${pi.status})`)
    }

    // Idempotency: if tickets for this PI already exist, return them.
    const { data: existing } = await supabase
      .from('tickets')
      .select('id, ticket_number, event_id')
      .eq('stripe_payment_intent_id', payment_intent_id)

    if (existing && existing.length > 0) {
      const { data: ev } = await supabase.from('events').select('slug').eq('id', existing[0].event_id).maybeSingle()
      return {
        statusCode: 200,
        body: JSON.stringify({ tickets: existing, event_slug: ev?.slug, idempotent: true }),
      }
    }

    const meta = pi.metadata || {}
    const event_id = meta.event_id
    const items    = JSON.parse(meta.items || '[]')
    const email    = meta.buyer_email || ''
    const name     = meta.buyer_name  || ''

    if (!event_id || !items.length) throw new Error('PaymentIntent missing event metadata')

    const { data: ev, error: evErr } = await supabase
      .from('events')
      .select('id, slug, capacity, tickets_sold')
      .eq('id', event_id)
      .maybeSingle()
    if (evErr || !ev) throw new Error('Event not found')

    const inserted = []
    let runningTicketsSold = ev.tickets_sold || 0

    for (const item of items) {
      const qty = Math.max(1, Math.floor(Number(item.qty) || 0))

      // Bump tier sold count first
      const { data: tier, error: tierErr } = await supabase
        .from('ticket_tiers')
        .select('id, sold, qty, name')
        .eq('id', item.tier_id)
        .maybeSingle()
      if (tierErr || !tier) throw new Error(`Tier ${item.tier_id} not found`)

      await supabase
        .from('ticket_tiers')
        .update({ sold: (tier.sold || 0) + qty })
        .eq('id', tier.id)

      // Write one ticket row per seat
      for (let i = 0; i < qty; i++) {
        runningTicketsSold += 1
        const { data: ticket, error: insertErr } = await supabase
          .from('tickets')
          .insert({
            event_id:                 event_id,
            email,
            name,
            quantity:                 1,
            ticket_number:            runningTicketsSold,
            stripe_payment_intent_id: payment_intent_id,
            tier_id:                  tier.id,
            tier_name:                tier.name,
          })
          .select('id, ticket_number')
          .single()
        if (insertErr) throw insertErr
        inserted.push(ticket)
      }
    }

    await supabase
      .from('events')
      .update({ tickets_sold: runningTicketsSold })
      .eq('id', event_id)

    return {
      statusCode: 200,
      body: JSON.stringify({ tickets: inserted, event_slug: ev.slug }),
    }
  } catch (err) {
    console.error('finalize-ticket-purchase error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
