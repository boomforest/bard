const Stripe  = require('stripe')
const { createClient } = require('@supabase/supabase-js')

// Promoter-initiated bar order refund.
//
// POST body:    { order_id }
// Auth header:  Authorization: Bearer <supabase access token>
//
// Same pattern as refund-ticket: verifies the caller owns the event,
// issues a full-amount Stripe refund (2% Grail fee non-refundable),
// marks the order refunded.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization
    const token = authHeader && authHeader.replace(/^Bearer /i, '')
    if (!token) throw new Error('Missing auth token')

    const { order_id } = JSON.parse(event.body || '{}')
    if (!order_id) throw new Error('order_id required')

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) throw new Error('Invalid session')

    const { data: order, error: oErr } = await supabase
      .from('bar_orders')
      .select('id, event_id, refunded, refund_id, stripe_payment_intent_id')
      .eq('id', order_id)
      .maybeSingle()
    if (oErr || !order) throw new Error('Order not found')

    if (order.refunded) {
      return {
        statusCode: 200,
        body: JSON.stringify({ order_id, refund_id: order.refund_id, idempotent: true }),
      }
    }

    if (!order.stripe_payment_intent_id) {
      throw new Error('Order has no Stripe payment to refund')
    }

    const { data: ev, error: evErr } = await supabase
      .from('events')
      .select('id, promoter_id')
      .eq('id', order.event_id)
      .maybeSingle()
    if (evErr || !ev) throw new Error('Event not found')
    if (ev.promoter_id !== user.id) throw new Error('Not authorized to refund this order')

    const refund = await stripe.refunds.create({
      payment_intent:         order.stripe_payment_intent_id,
      refund_application_fee: false,
      reverse_transfer:       true,
      metadata: { order_id, refunded_by: user.id },
    })

    await supabase
      .from('bar_orders')
      .update({
        refunded:    true,
        refunded_at: new Date().toISOString(),
        refund_id:   refund.id,
        refunded_by: user.id,
        status:      'refunded',
      })
      .eq('id', order_id)

    return {
      statusCode: 200,
      body: JSON.stringify({
        order_id,
        refund_id:             refund.id,
        amount_refunded_cents: refund.amount,
      }),
    }
  } catch (err) {
    console.error('refund-bar-order error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
