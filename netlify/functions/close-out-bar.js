const Stripe  = require('stripe')
const { createClient } = require('@supabase/supabase-js')

// Promoter-triggered: refund (loaded - spent) for every active bar tab
// on an event, then mark them refunded.
//
// POST body:    { event_id }
// Auth header:  Authorization: Bearer <supabase access token>
// Response:     { refunded: int, total_refunded_cents: int, errors: [] }
//
// Per Grail's Terms, the 2% platform fee on the original load is NOT
// refunded — promoter eats the fee on whatever portion of doves the
// buyer didn't end up spending. (The promoter still kept ~98% of the
// loaded amount; the refund pulls back only the unspent share.)
//
// SHOW/BAR ECONOMY — Refunds go back to the buyer's original card via
// Stripe. DO NOT WRITE to profiles.dov_balance from here. That column
// is the Casa de Copas Palomas wallet, a separate ledger.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization
    const token = authHeader && authHeader.replace(/^Bearer /i, '')
    if (!token) throw new Error('Missing auth token')

    const { event_id } = JSON.parse(event.body || '{}')
    if (!event_id) throw new Error('event_id required')

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) throw new Error('Invalid session')

    const { data: ev, error: evErr } = await supabase
      .from('events')
      .select('id, promoter_id')
      .eq('id', event_id)
      .maybeSingle()
    if (evErr || !ev) throw new Error('Event not found')
    if (ev.promoter_id !== user.id) throw new Error('Not authorized to close out this event')

    const { data: balances, error: bErr } = await supabase
      .from('bar_tabs')
      .select('*')
      .eq('event_id', event_id)
      .eq('status', 'active')
    if (bErr) throw bErr

    let refundedCount = 0
    let totalRefundedCents = 0
    const errors = []

    for (const b of balances || []) {
      const unspent = b.loaded_cents - b.spent_cents
      try {
        let refundResult = null
        if (unspent > 0) {
          refundResult = await stripe.refunds.create({
            payment_intent:         b.stripe_payment_intent_id,
            amount:                 unspent,
            refund_application_fee: false,
            reverse_transfer:       true,
            metadata: {
              kind:           'dove_closeout',
              balance_id:     b.id,
              event_id,
              refunded_by:    user.id,
            },
          })
        }
        await supabase
          .from('bar_tabs')
          .update({
            status:                 unspent === 0 ? 'depleted' : 'refunded',
            refund_id:              refundResult?.id || null,
            refunded_amount_cents:  unspent,
            refunded_at:            new Date().toISOString(),
            refunded_by:            user.id,
            updated_at:             new Date().toISOString(),
          })
          .eq('id', b.id)

        refundedCount += 1
        totalRefundedCents += unspent
      } catch (oneErr) {
        console.error(`close-out-bar: balance ${b.id} failed`, oneErr)
        errors.push({ balance_id: b.id, error: oneErr.message })
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        processed:           (balances || []).length,
        refunded:            refundedCount,
        total_refunded_cents: totalRefundedCents,
        errors,
      }),
    }
  } catch (err) {
    console.error('close-out-bar error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
