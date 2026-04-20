const Stripe  = require('stripe')
const { createClient } = require('@supabase/supabase-js')

// Promoter-initiated single-ticket refund.
//
// POST body:    { ticket_id }
// Auth header:  Authorization: Bearer <supabase access token>
//
// Response:
//   { ticket_id, refund_id, amount_refunded_cents }
//
// Behavior:
//   - Verifies the caller's session and that they own the event the ticket
//     belongs to (events.promoter_id === auth.uid())
//   - Issues a Stripe refund against the original PaymentIntent
//   - Per Grail's Terms, the 2% platform fee is NOT refunded — promoter
//     eats the loss when they choose to refund
//   - Marks the ticket refunded, decrements ticket_tiers.sold + events.tickets_sold
//   - Idempotent: if the ticket is already refunded, returns the existing refund id

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization
    const token = authHeader && authHeader.replace(/^Bearer /i, '')
    if (!token) throw new Error('Missing auth token')

    const { ticket_id } = JSON.parse(event.body || '{}')
    if (!ticket_id) throw new Error('ticket_id required')

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) throw new Error('Invalid session')

    const { data: ticket, error: tErr } = await supabase
      .from('tickets')
      .select('id, event_id, tier_id, refunded, refund_id, stripe_payment_intent_id, ticket_number')
      .eq('id', ticket_id)
      .maybeSingle()
    if (tErr || !ticket) throw new Error('Ticket not found')

    if (ticket.refunded) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ticket_id, refund_id: ticket.refund_id, idempotent: true }),
      }
    }

    if (!ticket.stripe_payment_intent_id) {
      throw new Error('Ticket has no Stripe payment to refund')
    }

    const { data: ev, error: evErr } = await supabase
      .from('events')
      .select('id, promoter_id, tickets_sold')
      .eq('id', ticket.event_id)
      .maybeSingle()
    if (evErr || !ev) throw new Error('Event not found')
    if (ev.promoter_id !== user.id) throw new Error('Not authorized to refund this ticket')

    // PaymentIntent may have charged for multiple tickets in the same cart.
    // Refund only this ticket's share by amount.
    let refundAmount = null
    if (ticket.tier_id) {
      const { data: tier } = await supabase
        .from('ticket_tiers')
        .select('price_cents, sold')
        .eq('id', ticket.tier_id)
        .maybeSingle()
      if (tier?.price_cents) refundAmount = tier.price_cents
    }

    const refund = await stripe.refunds.create({
      payment_intent: ticket.stripe_payment_intent_id,
      ...(refundAmount ? { amount: refundAmount } : {}),
      refund_application_fee: false,    // Grail keeps the 2% per Terms
      reverse_transfer:       true,     // pull the funds back from the connected account
      metadata: { ticket_id, ticket_number: String(ticket.ticket_number || ''), refunded_by: user.id },
    })

    // Update ticket
    await supabase
      .from('tickets')
      .update({
        refunded:     true,
        refunded_at:  new Date().toISOString(),
        refund_id:    refund.id,
        refunded_by:  user.id,
        torn:         true,    // belt + suspenders: refunded ticket can't be admitted
      })
      .eq('id', ticket_id)

    // Decrement counters (best-effort; not critical if these fail)
    if (ticket.tier_id) {
      const { data: tier } = await supabase.from('ticket_tiers').select('sold').eq('id', ticket.tier_id).maybeSingle()
      if (tier && (tier.sold || 0) > 0) {
        await supabase.from('ticket_tiers').update({ sold: tier.sold - 1 }).eq('id', ticket.tier_id)
      }
    }
    if ((ev.tickets_sold || 0) > 0) {
      await supabase.from('events').update({ tickets_sold: ev.tickets_sold - 1 }).eq('id', ev.id)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ticket_id,
        refund_id:             refund.id,
        amount_refunded_cents: refund.amount,
      }),
    }
  } catch (err) {
    console.error('refund-ticket error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
