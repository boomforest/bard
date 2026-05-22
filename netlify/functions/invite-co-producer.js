const { createClient } = require('@supabase/supabase-js')

// Promoter-initiated co-producer invite. The caller (event's promoter_id)
// adds another producer to their event by name + email + role + split %.
//
// POST body:    { event_id, name, email, role, split_pct }
// Auth header:  Authorization: Bearer <supabase access token>
//
// Behavior:
//   - Verifies caller owns the event (events.promoter_id === auth.uid())
//   - If email already maps to a profile, links event_producers.user_id
//     directly — no signup needed, they just need to log in and Greenlight.
//   - Otherwise generates a single-use invite_token and emails a signup link
//     to /join?co_invite=<token>. JoinPage redeems the token, sets
//     event_producers.user_id, and redirects to the contract page.
//
// Note: this does NOT validate that splits sum to 100% — that's a UI concern.
// The contract just isn't "done" until the promoter agrees the splits balance.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization
    const token = authHeader && authHeader.replace(/^Bearer /i, '')
    if (!token) throw new Error('Missing auth token')

    const body = JSON.parse(event.body || '{}')
    const { event_id, role, artist_user_id } = body
    let { name, email } = body
    const split_pct = Number(body.split_pct)

    if (!event_id) throw new Error('event_id required')
    if (!role?.trim()) throw new Error('Role required')
    if (!Number.isFinite(split_pct) || split_pct < 0 || split_pct > 100) {
      throw new Error('split_pct must be between 0 and 100')
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) throw new Error('Invalid session')

    // New path: book-by-user-id (from /a/<handle> "Book this artist" CTA).
    // Server-side lookup keeps the artist's email out of the promoter's
    // browser. Falls back to the email-based path if artist_user_id is
    // not provided (preserves the existing EventContractCard flow).
    if (artist_user_id) {
      const { data: artist } = await supabase
        .from('users')
        .select('id, email, artist_name, username, handle')
        .eq('id', artist_user_id)
        .maybeSingle()
      if (!artist?.email) throw new Error('Artist account not found')
      email = artist.email
      if (!name?.trim()) name = artist.artist_name || artist.username || artist.handle || 'Artist'
    }

    if (!name?.trim()) throw new Error('Producer name required')
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Valid email required')

    const { data: ev, error: evErr } = await supabase
      .from('events')
      .select('id, slug, name, promoter_id, show_date')
      .eq('id', event_id)
      .maybeSingle()
    if (evErr || !ev) throw new Error('Event not found')
    if (ev.promoter_id !== user.id) throw new Error('Not authorized for this event')

    // Already invited / already a producer on this event with this email?
    const normalizedEmail = email.trim().toLowerCase()
    const { data: existing } = await supabase
      .from('event_producers')
      .select('id')
      .eq('event_id', event_id)
      .ilike('email', normalizedEmail)
      .maybeSingle()
    if (existing) throw new Error('That email is already a producer on this event')

    // First co-producer added to a solo event? Auto-create a row for the
    // event's promoter (the caller) so both sides of the contract are
    // explicit. Their split = 100 - new producer's split. Their name comes
    // from profiles.name (fallback: email).
    const { count: producerCount } = await supabase
      .from('event_producers')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event_id)

    if ((producerCount || 0) === 0) {
      const { data: callerProfile } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', user.id)
        .maybeSingle()
      const callerName = callerProfile?.name || callerProfile?.email?.split('@')[0] || 'Promoter'
      const callerSplit = Math.max(0, 100 - split_pct)

      await supabase.from('event_producers').insert({
        event_id,
        name:    callerName,
        role:    'Promoter',
        split_pct: callerSplit,
        signed:  false,
        email:   callerProfile?.email || null,
        user_id: user.id,
        invite_token: null,
      })
    }

    // Try to link to an existing GRAIL account immediately.
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, name, email')
      .ilike('email', normalizedEmail)
      .maybeSingle()

    const needsInvite = !existingProfile

    // Generate the invite token even when the profile exists — it's harmless
    // (never sent) and lets us add the same row shape regardless.
    const inviteToken = needsInvite ? randomToken(32) : null

    const { data: producer, error: insertErr } = await supabase
      .from('event_producers')
      .insert({
        event_id,
        name:         name.trim(),
        role:         role.trim(),
        split_pct,
        signed:       false,
        email:        normalizedEmail,
        user_id:      existingProfile?.id || null,
        invite_token: inviteToken,
      })
      .select('id, name, role, split_pct, signed, email, user_id')
      .single()
    if (insertErr) throw insertErr

    // Send the invite email — best-effort, never blocks the success state.
    let emailSent = false
    let emailError = null
    if (needsInvite) {
      try {
        const host = event?.headers?.host || 'grail.mx'
        const proto = host.startsWith('localhost') || host.startsWith('127.')
          ? 'http'
          : event?.headers?.['x-forwarded-proto'] || 'https'
        const origin = `${proto}://${host}`
        const inviteUrl = `${origin}/join?co_invite=${inviteToken}`

        const res = await fetch(`${origin}/.netlify/functions/send-co-producer-invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email:       normalizedEmail,
            name:        name.trim(),
            role:        role.trim(),
            split_pct,
            event_name:  ev.name,
            event_slug:  ev.slug,
            event_date:  ev.show_date,
            invite_url:  inviteUrl,
            origin,
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
        producer,
        invite_sent:    needsInvite && emailSent,
        invite_error:   emailError,
        already_linked: !needsInvite,
      }),
    }
  } catch (err) {
    console.error('invite-co-producer error:', err)
    return { statusCode: 400, body: JSON.stringify({ error: err.message }) }
  }
}

function randomToken(bytes) {
  // 32 random bytes -> 64-char hex string. Service role only generates these
  // so a small token-collision window is acceptable; the unique partial index
  // on event_producers.invite_token catches the collision case at insert.
  const buf = require('crypto').randomBytes(bytes)
  return buf.toString('hex')
}
