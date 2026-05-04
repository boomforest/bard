const { createClient } = require('@supabase/supabase-js')

// Promoter-initiated comp / guest-list ticket minting.
//
// POST body:   { event_id, name, email, qty, tier_id?, lang? }
// Auth header: Authorization: Bearer <supabase access token>
//
// Behavior:
//   - Verifies the caller owns the event (events.promoter_id === auth.uid())
//   - Picks a tier (passed-in tier_id, else the event's first tier with
//     remaining capacity) — comps still consume capacity so we don't oversell
//   - Inserts `qty` ticket rows with stripe_payment_intent_id = null,
//     is_comp = true, discount_cents = full tier price
//   - Bumps tier.sold and events.tickets_sold
//   - Triggers send-event-confirmation so the guest gets a real ticket email
//
// Comp tickets are NOT refundable (no Stripe charge to reverse). Promoter
// can hide them from revenue rollups by filtering tickets.is_comp.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization
    const token = authHeader && authHeader.replace(/^Bearer /i, '')
    if (!token) throw new Error('Missing auth token')

    const body = JSON.parse(event.body || '{}')
    const { event_id, name, email, tier_id } = body
    const qty = Math.max(1, Math.min(50, Math.floor(Number(body.qty) || 1)))
    const lang = body.lang === 'en' ? 'en' : 'es'

    if (!event_id) throw new Error('event_id required')
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Valid email required')
    if (!name?.trim()) throw new Error('Guest name required')

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) throw new Error('Invalid session')

    const { data: ev, error: evErr } = await supabase
      .from('events')
      .select('id, slug, promoter_id, tickets_sold, capacity')
      .eq('id', event_id)
      .maybeSingle()
    if (evErr || !ev) throw new Error('Event not found')
    if (ev.promoter_id !== user.id) throw new Error('Not authorized for this event')

    // Capacity guard — comps eat capacity like paid tickets.
    if (ev.capacity && (ev.tickets_sold || 0) + qty > ev.capacity) {
      throw new Error(`Only ${Math.max(0, ev.capacity - (ev.tickets_sold || 0))} seat(s) left at the door`)
    }

    // Tier selection: explicit tier_id wins; else first tier with capacity.
    const { data: tiers, error: tierErr } = await supabase
      .from('ticket_tiers')
      .select('id, name, price_cents, qty, sold, sort_order')
      .eq('event_id', event_id)
      .order('sort_order', { ascending: true })
    if (tierErr) throw tierErr
    if (!tiers || tiers.length === 0) throw new Error('Event has no ticket tiers — create one first')

    let tier
    if (tier_id) {
      tier = tiers.find(t => t.id === tier_id)
      if (!tier) throw new Error('Tier not found')
    } else {
      tier = tiers.find(t => (t.qty - (t.sold || 0)) >= qty) || tiers[0]
    }
    const remaining = tier.qty - (tier.sold || 0)
    if (remaining < qty) {
      throw new Error(`${tier.name}: only ${remaining} left`)
    }

    // Bump sold first so tier counts stay consistent if email send fails later.
    await supabase
      .from('ticket_tiers')
      .update({ sold: (tier.sold || 0) + qty })
      .eq('id', tier.id)

    let runningTicketsSold = ev.tickets_sold || 0
    const inserted = []
    for (let i = 0; i < qty; i++) {
      runningTicketsSold += 1
      const { data: ticket, error: insertErr } = await supabase
        .from('tickets')
        .insert({
          event_id,
          email,
          name,
          quantity:                 1,
          ticket_number:            runningTicketsSold,
          stripe_payment_intent_id: null,
          tier_id:                  tier.id,
          tier_name:                tier.name,
          lang,
          is_comp:                  true,
          discount_cents:           tier.price_cents,
          source:                   'comp',
        })
        .select('id, ticket_number')
        .single()
      if (insertErr) throw insertErr
      inserted.push(ticket)
    }

    await supabase
      .from('events')
      .update({ tickets_sold: runningTicketsSold })
      .eq('id', event_id)

    // Best-effort confirmation email — same template paid buyers get.
    let emailSent = false
    let emailError = null
    if (inserted.length > 0) {
      try {
        // Build origin from headers, but force http for localhost — netlify
        // dev doesn't set x-forwarded-proto, so the default 'https' would
        // try to call https://localhost:8888 (no TLS) and fail.
        const host = event?.headers?.host || 'grail.mx'
        const proto = host.startsWith('localhost') || host.startsWith('127.')
          ? 'http'
          : event?.headers?.['x-forwarded-proto'] || 'https'
        const origin = `${proto}://${host}`
        const res = await fetch(`${origin}/.netlify/functions/send-event-confirmation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id,
            ticket_ids: inserted.map(t => t.id),
            buyer_email: email,
            buyer_name: name,
            origin,
            lang,
          }),
        })
        emailSent = res.ok
        if (!res.ok) emailError = (await res.json().catch(() => ({}))).error || `${res.status}`
      } catch (e) {
        emailError = e.message
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        tickets: inserted,
        event_slug: ev.slug,
        tier_name: tier.name,
        email_sent: emailSent,
        email_error: emailError,
      }),
    }
  } catch (err) {
    console.error('mint-comp-tickets error:', err)
    return { statusCode: 400, body: JSON.stringify({ error: err.message }) }
  }
}
