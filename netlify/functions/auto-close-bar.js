// Scheduled function — runs daily and tries the standard refund flow on
// any bar_tabs still active after their event has happened.
//
// Cadence (per netlify.toml):  0 12 * * *   (noon UTC, daily)
//
// Logic per tab:
//   1. If event.show_date is in the past, attempt a normal refund
//      (reverse_transfer:true). Succeeds the moment the bar's Connect
//      account has cleared funds available — typically a few days after
//      the event, depending on Stripe's payout schedule for that
//      account.
//   2. If reverse_transfer fails, log it to the /admin Errors inbox
//      and move on. Tomorrow's run will try again.
//   3. Tabs with status='active' and no unspent balance just get
//      marked 'depleted' (no refund needed).
//
// EXPLICITLY does NOT fall back to platform-balance refunds. JP doesn't
// want auto-drains on his platform balance — that's a customer/promoter
// dispute he'd be absorbing the cost of. The only path to a
// platform-balance refund is the manual admin-only button in
// PromoterEventDetail.
//
// SHOW/BAR ECONOMY — refunds go back to the buyer's original card via
// Stripe. DO NOT WRITE to profiles.dov_balance from here.

const Stripe = require('stripe')
const { createClient } = require('@supabase/supabase-js')
const { reportServerError } = require('./_lib/server-error-report.cjs')

exports.handler = async () => {
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  const nowIso = new Date().toISOString()

  const { data: tabs, error: tabsErr } = await supabase
    .from('bar_tabs')
    .select('id, event_id, loaded_cents, spent_cents, stripe_payment_intent_id, events!inner(show_date)')
    .eq('status', 'active')
    .lt('events.show_date', nowIso)

  if (tabsErr) {
    console.error('auto-close-bar: failed to fetch tabs', tabsErr)
    return { statusCode: 500, body: JSON.stringify({ error: tabsErr.message }) }
  }

  const summary = { processed: 0, refunded: 0, depleted: 0, errors: [] }

  for (const tab of tabs || []) {
    summary.processed += 1
    const unspent = tab.loaded_cents - tab.spent_cents

    // Nothing to refund — mark depleted and move on
    if (unspent <= 0) {
      await supabase
        .from('bar_tabs')
        .update({ status: 'depleted', updated_at: new Date().toISOString() })
        .eq('id', tab.id)
      summary.depleted += 1
      continue
    }

    let refund = null
    let lastError = null

    try {
      // Idempotency key — same shape as close-out-bar. A retry after a
      // failed Supabase update will return the existing refund instead
      // of creating a duplicate. Critical for the scheduled fn since
      // it runs daily and would otherwise re-attempt every active tab.
      refund = await stripe.refunds.create({
        payment_intent:         tab.stripe_payment_intent_id,
        amount:                 unspent,
        refund_application_fee: false,
        reverse_transfer:       true,
        metadata: {
          kind:        'dove_closeout',
          balance_id:  tab.id,
          event_id:    tab.event_id,
          source:      'connected_account',
          trigger:     'auto',
        },
      }, {
        idempotencyKey: `closeout_${tab.id}_connected`,
      })
    } catch (e) {
      lastError = e
    }

    if (refund) {
      await supabase
        .from('bar_tabs')
        .update({
          status:                 'refunded',
          refund_id:              refund.id,
          refunded_amount_cents:  unspent,
          refunded_at:            new Date().toISOString(),
          updated_at:             new Date().toISOString(),
        })
        .eq('id', tab.id)
      summary.refunded += 1
    } else {
      console.warn(`auto-close-bar: tab ${tab.id} refund failed`, lastError?.message)
      summary.errors.push({ balance_id: tab.id, error: lastError?.message || 'unknown' })
      // Surface to /admin Errors inbox so JP knows when promoter
      // accounts have stuck pending balances. Scheduled fn has no
      // client to bubble errors back to.
      await reportServerError({
        message: `auto-close-bar: ${lastError?.message || 'unknown error'}`,
        stack:   lastError?.stack,
        context: {
          fn:            'auto-close-bar',
          balance_id:    tab.id,
          event_id:      tab.event_id,
          unspent_cents: unspent,
          stripe_code:   lastError?.code || null,
          stripe_type:   lastError?.type || null,
        },
      })
    }
  }

  console.log('auto-close-bar summary', summary)
  return { statusCode: 200, body: JSON.stringify(summary) }
}
