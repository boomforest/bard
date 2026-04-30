// Scheduled function — runs daily and tries to close out any bar_tabs
// that are still active for events that have already happened.
//
// Cadence (per netlify.toml):  0 12 * * *   (noon UTC, daily)
//
// Logic per tab:
//   1. If event.show_date is in the past, attempt a normal refund
//      (reverse_transfer:true). This will succeed when the bar's
//      Connect account has cleared funds available.
//   2. If reverse_transfer fails AND the show was 7+ days ago, retry
//      with reverse_transfer:false (platform-balance fallback). The
//      platform absorbs the float; reconcile when the bar's pending
//      funds eventually settle.
//   3. Tabs with status='active' and no unspent balance just get
//      marked 'depleted' (no refund needed).
//
// SHOW/BAR ECONOMY — refunds go back to the buyer's original card via
// Stripe. DO NOT WRITE to profiles.dov_balance from here.

const Stripe = require('stripe')
const { createClient } = require('@supabase/supabase-js')

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS

exports.handler = async () => {
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  // Pull active tabs whose event has already happened. We do the
  // 7-day cutoff per-tab rather than in SQL so we can cleanly
  // distinguish "try standard refund first" vs "fall back to platform
  // balance".
  const now = Date.now()
  const { data: tabs, error: tabsErr } = await supabase
    .from('bar_tabs')
    .select('id, event_id, loaded_cents, spent_cents, stripe_payment_intent_id, events!inner(show_date)')
    .eq('status', 'active')
    .lt('events.show_date', new Date(now).toISOString())

  if (tabsErr) {
    console.error('auto-close-bar: failed to fetch tabs', tabsErr)
    return { statusCode: 500, body: JSON.stringify({ error: tabsErr.message }) }
  }

  const summary = { processed: 0, refunded: 0, platform_fallback: 0, depleted: 0, errors: [] }

  for (const tab of tabs || []) {
    summary.processed += 1
    const unspent = tab.loaded_cents - tab.spent_cents

    // Nothing to refund — just mark depleted
    if (unspent <= 0) {
      await supabase
        .from('bar_tabs')
        .update({ status: 'depleted', updated_at: new Date().toISOString() })
        .eq('id', tab.id)
      summary.depleted += 1
      continue
    }

    const showDate = tab.events?.show_date ? new Date(tab.events.show_date).getTime() : 0
    const daysSinceShow = (now - showDate) / ONE_DAY_MS
    const allowPlatformFallback = daysSinceShow >= 7

    let refund = null
    let usedFallback = false
    let lastError = null

    // Pass 1: standard reverse-transfer
    try {
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
      })
    } catch (e) {
      lastError = e
    }

    // Pass 2: platform-balance fallback if standard failed AND
    // the show is 7+ days behind us
    if (!refund && allowPlatformFallback) {
      try {
        refund = await stripe.refunds.create({
          payment_intent:         tab.stripe_payment_intent_id,
          amount:                 unspent,
          refund_application_fee: false,
          reverse_transfer:       false,
          metadata: {
            kind:        'dove_closeout',
            balance_id:  tab.id,
            event_id:    tab.event_id,
            source:      'platform_balance',
            trigger:     'auto_after_grace',
          },
        })
        usedFallback = true
      } catch (e) {
        lastError = e
      }
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
      if (usedFallback) summary.platform_fallback += 1
    } else {
      console.warn(`auto-close-bar: tab ${tab.id} refund failed`, lastError?.message)
      summary.errors.push({ balance_id: tab.id, error: lastError?.message || 'unknown' })
    }
  }

  console.log('auto-close-bar summary', summary)
  return { statusCode: 200, body: JSON.stringify(summary) }
}
