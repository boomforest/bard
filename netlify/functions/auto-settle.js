const Stripe = require('stripe')
const { createClient } = require('@supabase/supabase-js')
const { reportServerError } = require('./_lib/server-error-report.cjs')

// Scheduled settlement. Runs daily after auto-close-bar so any event that's
// (a) finished, (b) had its bar closed, and (c) has a fully greenlit
// contract auto-pays each co-producer their share.
//
// Cadence (per netlify.toml):  0 13 * * *   (1pm UTC daily, 1h after
// auto-close-bar's noon UTC run)
//
// Eligibility:
//   - events.greenlit_at IS NOT NULL
//   - events.settled_at  IS NULL
//   - events.show_date   < now() - interval '24 hours'  (show is over)
//   - bar_tabs has no row with status='active' for this event
//
// Mirrors run-settlement.js but uses service role (no human in the loop)
// and skips the auth check. The actual transfer logic is identical:
// settlement_breakdown RPC for math, Stripe transfers between connected
// accounts, idempotency key per producer so a retry never double-pays.

exports.handler = async () => {
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: candidates, error: candErr } = await supabase
      .from('events')
      .select('id, slug, name, currency, promoter_id, show_date, greenlit_at, settled_at')
      .not('greenlit_at', 'is', null)
      .is('settled_at', null)
      .not('show_date', 'is', null)
      .lt('show_date', cutoff)
    if (candErr) throw candErr

    const summary = []

    for (const ev of (candidates || [])) {
      try {
        // Skip if the bar isn't fully closed for this event yet — settling
        // before close-out would undercount bar revenue.
        const { count: openTabs } = await supabase
          .from('bar_tabs')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', ev.id)
          .eq('status', 'active')
        if ((openTabs || 0) > 0) {
          summary.push({ event: ev.slug || ev.id, status: 'skipped', reason: `${openTabs} bar tab(s) still active` })
          continue
        }

        const result = await settleOne(stripe, supabase, ev)
        summary.push({ event: ev.slug || ev.id, status: result.complete ? 'settled' : 'partial', ...result })

        // Receipt emails (per-producer + lead summary). Best-effort.
        if (result.transfers.length > 0 || result.skipped.length > 0) {
          try {
            await fetch('https://grail.mx/.netlify/functions/send-settlement-receipt', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({
                event_id:  ev.id,
                transfers: result.transfers,
                skipped:   result.skipped,
                currency:  ev.currency || 'mxn',
                complete:  result.complete,
              }),
            })
          } catch (e) {
            console.warn(`receipt email failed for ${ev.slug}:`, e.message)
          }
        }
      } catch (err) {
        console.error(`auto-settle event ${ev.id} failed:`, err.message)
        summary.push({ event: ev.slug || ev.id, status: 'error', error: err.message })
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        scanned:    (candidates || []).length,
        summary,
      }),
    }
  } catch (err) {
    console.error('auto-settle error:', err)
    await reportServerError({
      message: `auto-settle failed: ${err.message}`,
      stack:   err.stack,
      context: { fn: 'auto-settle', cadence: '0 13 * * *' },
    })
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

// ─── settle a single event (mirror of run-settlement.js core) ───────────
async function settleOne(stripe, supabase, ev) {
  const { data: leadProfile } = await supabase
    .from('users')
    .select('stripe_account_id')
    .eq('id', ev.promoter_id)
    .maybeSingle()
  if (!leadProfile?.stripe_account_id) {
    throw new Error('lead promoter has no connected Stripe account')
  }
  const leadAccount = leadProfile.stripe_account_id
  const currency    = (ev.currency || 'mxn').toLowerCase()

  const { data: breakdown, error: brErr } = await supabase.rpc('settlement_breakdown', { p_event_id: ev.id })
  if (brErr) throw brErr
  if (!breakdown || breakdown.length === 0) throw new Error('no producers')

  const nonLeadUserIds = breakdown.filter(p => !p.is_lead && p.user_id).map(p => p.user_id)
  let accountByUser = {}
  if (nonLeadUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('users')
      .select('id, stripe_account_id')
      .in('id', nonLeadUserIds)
    accountByUser = Object.fromEntries((profiles || []).map(p => [p.id, p]))
  }

  const transfers = []
  const skipped   = []
  let transferredCents = 0

  for (const p of breakdown) {
    if (p.is_lead)         { skipped.push({ name: p.name, reason: 'lead' });          continue }
    if (p.settled_at)      { skipped.push({ name: p.name, reason: 'already settled' }); continue }
    if (!p.signed)         { skipped.push({ name: p.name, reason: 'not signed' });    continue }
    if (!p.share_cents)    { skipped.push({ name: p.name, reason: '0 share' });       continue }
    const acct = accountByUser[p.user_id]?.stripe_account_id
    if (!acct)             { skipped.push({ name: p.name, reason: 'no Stripe account' }); continue }

    const idempotencyKey = `settlement_${ev.id}_${p.producer_id}`
    try {
      const transfer = await stripe.transfers.create(
        {
          amount:      p.share_cents,
          currency,
          destination: acct,
          description: `Auto-settlement: ${ev.name || ev.slug || ev.id} — ${p.name} (${p.split_pct}%)`,
          metadata: {
            event_id:       ev.id,
            event_slug:     ev.slug || '',
            producer_id:    p.producer_id,
            producer_name:  p.name,
            producer_role:  p.role,
            producer_split: String(p.split_pct),
            auto_settled:   '1',
          },
        },
        { stripeAccount: leadAccount, idempotencyKey },
      )

      await supabase
        .from('event_producers')
        .update({
          settled_at:           new Date().toISOString(),
          settled_amount_cents: p.share_cents,
          stripe_transfer_id:   transfer.id,
        })
        .eq('id', p.producer_id)

      transfers.push({ producer_id: p.producer_id, name: p.name, amount_cents: p.share_cents, transfer_id: transfer.id })
      transferredCents += p.share_cents
    } catch (transferErr) {
      console.error(`auto-settle transfer failed for ${p.name}:`, transferErr.message)
      skipped.push({ name: p.name, reason: `transfer failed: ${transferErr.message}` })
    }
  }

  const stillOwed = breakdown.filter(p =>
    !p.is_lead && p.share_cents > 0 && p.signed
  ).filter(p => !transfers.find(r => r.name === p.name) && !p.settled_at)

  const complete = stillOwed.length === 0
  if (complete) {
    await supabase
      .from('events')
      .update({ settled_at: new Date().toISOString() })
      .eq('id', ev.id)
  }

  return { transferred_cents: transferredCents, transfers, skipped, complete }
}
