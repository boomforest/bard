// Scheduled function — runs daily and tries the standard refund flow
// on any bar_tabs that have been active for more than 12 hours.
//
// Cadence (per netlify.toml):  0 12 * * *   (noon UTC, daily)
//
// Eligibility: status='active' AND created_at < now() - 12 hours.
// We don't tie this to event.show_date anymore. Rationale: a buyer
// who loaded $X for a Friday show doesn't need to keep that balance
// alive into Saturday — if they come back for a multi-day event, they
// can reload. The 12h floor protects same-day shows: a tab loaded at
// 8 PM doesn't get refunded at noon (16h later, edge case) — it'd
// take until the *next* noon (28h+) to refund.
//
// Logic per tab:
//   1. Attempt a normal refund (reverse_transfer:true). Succeeds once
//      the bar's Connect account has cleared funds — typically a few
//      days after the charge, depending on Stripe's payout schedule.
//   2. If reverse_transfer fails, log to /admin Errors inbox and move
//      on. Tomorrow's run will try again.
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

const STALE_THRESHOLD_HOURS = 12

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

  const cutoffIso = new Date(Date.now() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000).toISOString()

  const { data: tabs, error: tabsErr } = await supabase
    .from('bar_tabs')
    .select('id, event_id, email, lang, loaded_cents, spent_cents, stripe_payment_intent_id, events(name, artist_name, currency)')
    .eq('status', 'active')
    .lt('created_at', cutoffIso)

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

      // Best-effort buyer email. Same fire-and-forget pattern as
      // close-out-bar — refund is already committed if this throws.
      if (tab.email) {
        const host = process.env.URL || 'https://grail.mx'
        fetch(`${host}/.netlify/functions/send-refund-confirmation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email:        tab.email,
            amount_cents: unspent,
            currency:     tab.events?.currency || 'mxn',
            event_name:   tab.events?.name || tab.events?.artist_name || null,
            lang:         tab.lang || 'es',
          }),
        }).catch(mailErr => console.warn('refund email failed (non-fatal):', mailErr.message))
      }
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
