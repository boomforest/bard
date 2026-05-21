const Stripe = require('stripe')
const { createClient } = require('@supabase/supabase-js')

// Multi-producer settlement. The lead promoter (event.promoter_id) triggers
// this after the show; ticket revenue already routed to their Stripe Connect
// balance at sale time, so we move co-producer shares from their account to
// each co-producer's account using Stripe transfers between connected
// accounts.
//
// POST body:    { event_id }
// Auth header:  Authorization: Bearer <supabase access token>
//
// Behavior:
//   - Verifies caller is the event's promoter_id
//   - Verifies event is greenlit (greenlit_at not null) and not already settled
//   - Calls settlement_breakdown RPC for the math
//   - For each non-lead producer with split_pct > 0, signed = true, and a
//     stripe_account_id on their profile, creates a Stripe transfer from the
//     lead's account to theirs
//   - Stamps settled_amount_cents + stripe_transfer_id + settled_at per
//     producer row, then events.settled_at on success
//   - Idempotent at the producer-row level: if a transfer succeeded
//     previously (settled_at set), skips that row on retry

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
      .select('id, slug, name, promoter_id, currency, greenlit_at, settled_at')
      .eq('id', event_id)
      .maybeSingle()
    if (evErr || !ev) throw new Error('Event not found')
    if (ev.promoter_id !== user.id) throw new Error('Not authorized for this event')
    if (!ev.greenlit_at) throw new Error('Contract is not greenlit yet — every producer must sign first')
    if (ev.settled_at) throw new Error('This event was already settled on ' + ev.settled_at)

    // Lead promoter's Stripe account (source of all transfers)
    const { data: leadProfile } = await supabase
      .from('users')
      .select('stripe_account_id, stripe_charges_enabled')
      .eq('id', ev.promoter_id)
      .maybeSingle()
    if (!leadProfile?.stripe_account_id) {
      throw new Error('Lead promoter has no connected Stripe account')
    }

    const leadAccount = leadProfile.stripe_account_id
    const currency    = (ev.currency || 'mxn').toLowerCase()

    // Math from the RPC — single source of truth shared with the UI preview
    const { data: breakdown, error: brErr } = await supabase.rpc('settlement_breakdown', { p_event_id: event_id })
    if (brErr) throw brErr
    if (!breakdown || breakdown.length === 0) throw new Error('No producers on this event')

    // Pull each non-lead producer's stripe_account_id in one batch
    const nonLeadUserIds = breakdown.filter(p => !p.is_lead && p.user_id).map(p => p.user_id)
    let accountByUser = {}
    if (nonLeadUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('users')
        .select('id, stripe_account_id, stripe_charges_enabled')
        .in('id', nonLeadUserIds)
      accountByUser = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    }

    const results  = []
    const skipped  = []
    let transferredCents = 0

    for (const p of breakdown) {
      if (p.is_lead) {
        skipped.push({ producer_id: p.producer_id, name: p.name, reason: 'lead — keeps remainder in their balance' })
        continue
      }
      if (p.settled_at) {
        skipped.push({ producer_id: p.producer_id, name: p.name, reason: 'already settled' })
        continue
      }
      if (!p.signed) {
        skipped.push({ producer_id: p.producer_id, name: p.name, reason: 'not greenlit (skipped, contract trigger should have caught)' })
        continue
      }
      if (!p.share_cents || p.share_cents <= 0) {
        skipped.push({ producer_id: p.producer_id, name: p.name, reason: '0 share' })
        continue
      }
      const acct = accountByUser[p.user_id]?.stripe_account_id
      if (!acct) {
        skipped.push({ producer_id: p.producer_id, name: p.name, reason: 'no connected Stripe account — ask them to onboard via /promoter' })
        continue
      }

      // Create the transfer FROM lead's connected account TO co-producer's
      // account by setting Stripe-Account header to the lead. Idempotency
      // key prevents double-pay if the function is retried after a network
      // hiccup mid-loop.
      const idempotencyKey = `settlement_${event_id}_${p.producer_id}`
      try {
        const transfer = await stripe.transfers.create(
          {
            amount:      p.share_cents,
            currency,
            destination: acct,
            description: `Settlement: ${ev.name || ev.slug || event_id} — ${p.name} (${p.split_pct}%)`,
            metadata: {
              event_id,
              event_slug:        ev.slug || '',
              producer_id:       p.producer_id,
              producer_name:     p.name,
              producer_role:     p.role,
              producer_split:    String(p.split_pct),
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

        results.push({ producer_id: p.producer_id, name: p.name, amount_cents: p.share_cents, transfer_id: transfer.id })
        transferredCents += p.share_cents
      } catch (transferErr) {
        // Don't abort the whole settlement on a single transfer failure —
        // the others should still go through. Log + return so JP can retry
        // the failed ones.
        console.error(`transfer failed for ${p.name}:`, transferErr.message)
        skipped.push({ producer_id: p.producer_id, name: p.name, reason: `transfer failed: ${transferErr.message}` })
      }
    }

    // Stamp event.settled_at if everyone non-lead with a positive share is
    // settled (or skipped for valid no-op reasons). We don't want a half-
    // settled event marked complete; instead leave settled_at null so JP
    // sees "still needs work" in the UI.
    const stillOwed = breakdown.filter(p =>
      !p.is_lead && p.share_cents > 0 && p.signed
    ).filter(p => !results.find(r => r.producer_id === p.producer_id) && !p.settled_at)

    if (stillOwed.length === 0) {
      await supabase
        .from('events')
        .update({ settled_at: new Date().toISOString() })
        .eq('id', event_id)
    }

    // Best-effort receipt emails (per-producer + lead summary). Never
    // blocks the success response.
    if (results.length > 0 || skipped.length > 0) {
      const host = event?.headers?.host || 'grail.mx'
      const proto = host.startsWith('localhost') || host.startsWith('127.')
        ? 'http'
        : event?.headers?.['x-forwarded-proto'] || 'https'
      const origin = `${proto}://${host}`
      try {
        await fetch(`${origin}/.netlify/functions/send-settlement-receipt`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            event_id,
            transfers: results,
            skipped,
            currency,
            complete:  stillOwed.length === 0,
          }),
        })
      } catch (e) {
        console.warn('settlement receipt email failed (non-fatal):', e.message)
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        event_id,
        transferred_cents: transferredCents,
        currency,
        transfers: results,
        skipped,
        complete: stillOwed.length === 0,
      }),
    }
  } catch (err) {
    console.error('run-settlement error:', err)
    return { statusCode: 400, body: JSON.stringify({ error: err.message }) }
  }
}
