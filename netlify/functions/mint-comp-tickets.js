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
    const { name, email, tier_id, producer_id } = body
    let { event_id } = body
    const qty = Math.max(1, Math.min(50, Math.floor(Number(body.qty) || 1)))
    const lang = body.lang === 'en' ? 'en' : 'es'

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Valid email required')
    if (!name?.trim()) throw new Error('Guest name required')
    if (!event_id && !producer_id) throw new Error('event_id or producer_id required')

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) throw new Error('Invalid session')

    // Artist path: producer_id provided. Verify the caller is the
    // artist on that producer row, check remaining allotment, derive
    // event_id from the producer row. Set source='artist:<producer_id>'
    // so the count + attribution match the affiliate-link pattern.
    let allotmentSource = null  // when set, becomes tickets.source
    if (producer_id) {
      const { data: producer } = await supabase
        .from('event_producers')
        .select('id, event_id, user_id, role, ticket_allotment')
        .eq('id', producer_id)
        .maybeSingle()
      if (!producer) throw new Error('Producer row not found')
      if (producer.user_id !== user.id) throw new Error('Not authorized for this allotment')
      if (producer.role !== 'Artist') throw new Error('Allotment minting is artist-only')
      if (!producer.ticket_allotment || producer.ticket_allotment <= 0) {
        throw new Error('No ticket allotment on this booking')
      }
      // Count tickets already consumed from the allotment (comps + sales).
      const { count: used } = await supabase
        .from('tickets')
        .select('id', { count: 'exact', head: true })
        .eq('source', `artist:${producer.id}`)
        .eq('refunded', false)
      const remaining = producer.ticket_allotment - (used || 0)
      if (remaining < qty) {
        throw new Error(`Only ${Math.max(0, remaining)} ticket(s) left in your allotment`)
      }
      event_id = producer.event_id
      allotmentSource = `artist:${producer.id}`
    }

    const { data: ev, error: evErr } = await supabase
      .from('events')
      .select('id, slug, promoter_id, tickets_sold, capacity')
      .eq('id', event_id)
      .maybeSingle()
    if (evErr || !ev) throw new Error('Event not found')

    // Authorization: promoter path requires owning the event. Artist
    // path was already authorized above via producer ownership check.
    if (!producer_id && ev.promoter_id !== user.id) {
      throw new Error('Not authorized for this event')
    }

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

    // Insert tickets first; only bump counters after each row lands. If an
    // insert fails mid-loop the counters reflect what's actually in the table,
    // not the intended quantity. Counter writes use atomic SQL via RPC so two
    // concurrent callers can't lose increments.
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
          source:                   allotmentSource || 'comp',
        })
        .select('id, ticket_number')
        .single()
      if (insertErr) throw insertErr
      inserted.push(ticket)
    }

    if (inserted.length > 0) {
      await supabase.rpc('bump_tier_sold',         { p_tier_id: tier.id,     p_delta: inserted.length })
      await supabase.rpc('bump_event_tickets_sold', { p_event_id: event_id,  p_delta: inserted.length })
    }

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
