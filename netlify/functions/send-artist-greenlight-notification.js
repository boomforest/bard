// Artist-triggered broadcast: when an artist Greenlights their booking
// on a lineup (event_producers row with role='Artist', signed=true),
// their followers in the event's geo-radius get a "{artist} just
// confirmed a show" email.
//
// Auth: Bearer access token of the artist (the producer.user_id).
// POST body: { producer_id, origin? }
//
// Eligibility gates (all must pass; otherwise return ok=true, sent=0):
//   - producer row exists, role='Artist', signed=true, user_id matches caller
//   - user.broadcast_default is true
//   - producer.broadcast_disabled is false
//   - producer.last_broadcast_at is null (don't re-blast on un-sign cycles)
//
// On success: stamps producer.last_broadcast_at and followers.notified_at.
//
// Mirrors send-new-event-notification.js's structure; uses the shared
// i18n + the artist_followers_in_event_radius RPC from migration 034.

const { createClient } = require('@supabase/supabase-js')
const { t, pickLang, fmtDate } = require('./_lib/email-i18n.cjs')

const escapeHtml = (s) =>
  String(s || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]))

const renderHtml = ({ artistName, eventName, dateStr, venue, eventUrl, recipientName, L }) => `
  <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #08080c; color: #e8e0d0;">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #dd22aa 0%, #f07020 100%); line-height: 56px; color: #fff; font-weight: 900; font-size: 12px; letter-spacing: -0.02em;">GRAIL</div>
    </div>

    <div style="background: #12121a; border: 1px solid #1e1e2a; border-radius: 14px; padding: 24px; margin-bottom: 20px;">
      <div style="font-size: 11px; color: #aaff00; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; margin-bottom: 8px;">${escapeHtml(t(L, 'artistGreenlight.eyebrow'))}</div>
      <div style="font-size: 22px; font-weight: 900; color: #e8e0d0; letter-spacing: -0.02em; margin-bottom: 12px;">${escapeHtml(artistName)} → ${escapeHtml(eventName)}</div>
      <div style="color: #8a8098; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
        ${escapeHtml(dateStr)}${venue ? `<br>${escapeHtml(venue)}` : ''}
      </div>
      <div style="color: #c8c0d0; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
        ${escapeHtml(recipientName ? t(L, 'artistGreenlight.greeting', { name: recipientName }) + ' ' : '')}${escapeHtml(t(L, 'artistGreenlight.body', { artist: artistName, event: eventName }))}
      </div>
      <p style="margin: 14px 0 0;">
        <a href="${eventUrl}" style="display: inline-block; background: linear-gradient(135deg, #dd22aa 0%, #f07020 100%); color: #000; font-weight: 800; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-size: 14px;">${escapeHtml(t(L, 'artistGreenlight.cta'))}</a>
      </p>
    </div>

    <div style="text-align: center; color: #3a3448; font-size: 11px; letter-spacing: 0.05em;">
      Powered by GRAIL · grail.mx<br>
      <span style="color: #8a8098;">${escapeHtml(t(L, 'artistGreenlight.footer', { artist: artistName }))}</span>
    </div>
  </div>
`

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { producer_id, origin } = JSON.parse(event.body || '{}')
    if (!producer_id) throw new Error('producer_id required')

    const auth = event.headers.authorization || event.headers.Authorization
    if (!auth?.startsWith('Bearer ')) throw new Error('Missing auth token')
    const accessToken = auth.slice(7)

    const admin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    const { data: caller, error: userErr } = await admin.auth.getUser(accessToken)
    if (userErr || !caller?.user) throw new Error('Invalid session')
    const callerId = caller.user.id

    // Load the producer row + the parent event + the artist's user row.
    const { data: producer, error: prErr } = await admin
      .from('event_producers')
      .select('id, event_id, user_id, role, signed, broadcast_disabled, last_broadcast_at, name')
      .eq('id', producer_id)
      .maybeSingle()
    if (prErr || !producer) throw new Error('Producer row not found')

    if (producer.user_id !== callerId) {
      // Admin override for support cases
      const { data: callerRow } = await admin.from('users').select('is_admin').eq('id', callerId).maybeSingle()
      if (!callerRow?.is_admin) throw new Error('Not authorized for this producer row')
    }

    // Eligibility gates — none of these are errors, just "don't broadcast."
    if (producer.role !== 'Artist') {
      return { statusCode: 200, body: JSON.stringify({ ok: true, sent: 0, total: 0, reason: 'not_artist_role' }) }
    }
    if (!producer.signed) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, sent: 0, total: 0, reason: 'not_signed' }) }
    }
    if (producer.broadcast_disabled) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, sent: 0, total: 0, reason: 'broadcast_disabled' }) }
    }
    if (producer.last_broadcast_at) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, sent: 0, total: 0, reason: 'already_broadcast' }) }
    }
    if (!producer.user_id) {
      // Producer row hasn't been claimed by an artist account yet — nothing
      // to fan out to (no artist_followers without an artist_id).
      return { statusCode: 200, body: JSON.stringify({ ok: true, sent: 0, total: 0, reason: 'no_artist_account' }) }
    }

    const { data: artistRow } = await admin
      .from('users')
      .select('id, username, handle, artist_name, broadcast_default')
      .eq('id', producer.user_id)
      .maybeSingle()
    if (!artistRow) throw new Error('Artist user row not found')

    if (artistRow.broadcast_default === false) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, sent: 0, total: 0, reason: 'broadcast_default_off' }) }
    }

    const { data: ev, error: evErr } = await admin
      .from('events')
      .select('id, slug, name, artist_name, show_date, doors_time, venue_hint, venue_address')
      .eq('id', producer.event_id)
      .maybeSingle()
    if (evErr || !ev) throw new Error('Event not found')

    // Followers in radius for this specific artist + event venue.
    const { data: rows, error: flErr } = await admin
      .rpc('artist_followers_in_event_radius', {
        p_event_id:  ev.id,
        p_artist_id: artistRow.id,
      })
    if (flErr) throw new Error(flErr.message)
    if (!rows || rows.length === 0) {
      // Stamp anyway so we don't re-evaluate every page load.
      await admin
        .from('event_producers')
        .update({ last_broadcast_at: new Date().toISOString() })
        .eq('id', producer.id)
      return { statusCode: 200, body: JSON.stringify({ ok: true, sent: 0, total: 0 }) }
    }

    // The artist name shown in the email — prefer their display name,
    // then the producer.name (what the promoter typed when adding them),
    // then handle, then a generic fallback.
    const artistName = artistRow.artist_name
                   || artistRow.username
                   || producer.name
                   || artistRow.handle
                   || 'An artist'
    const eventName  = ev.name || ev.artist_name || 'Show'
    const venue      = ev.venue_hint || ev.venue_address || ''
    const baseUrl    = origin || 'https://grail.mx'
    // Affiliate-attributed ticket link. The `artist:` prefix lets us
    // distinguish artist refs from plain promoter refs (`ig`, `email`,
    // etc.) when reading tickets.source for attribution. EventPage caches
    // the ref in sessionStorage; create-payment-intent.js sanitizer
    // allows `:` and 64-char length specifically for this format.
    const eventUrl   = `${baseUrl}/e/${ev.slug}?ref=artist:${producer.id}`
    const from       = process.env.EMAIL_FROM || 'GRAIL <tickets@casadecopas.com>'

    const sentIds = []
    const errors = []

    for (const row of rows) {
      try {
        const L = pickLang(row.lang)
        const dateStr = fmtDate(ev.show_date, L)
        const subject = t(L, 'artistGreenlight.subject', { artist: artistName })
        const html = renderHtml({
          artistName,
          eventName,
          dateStr,
          venue,
          eventUrl,
          recipientName: row.name || '',
          L,
        })
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({ from, to: [row.email], subject, html }),
        })
        if (!res.ok) {
          const body = await res.text()
          errors.push({ email: row.email, error: `Resend ${res.status}: ${body.slice(0, 120)}` })
          continue
        }
        sentIds.push(row.id)
      } catch (err) {
        errors.push({ email: row.email, error: err.message })
      }
    }

    if (sentIds.length > 0) {
      await admin
        .from('artist_followers')
        .update({ notified_at: new Date().toISOString() })
        .in('id', sentIds)
    }

    // Stamp the producer row so we never re-blast for this booking.
    await admin
      .from('event_producers')
      .update({ last_broadcast_at: new Date().toISOString() })
      .eq('id', producer.id)

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, sent: sentIds.length, total: rows.length, errors }),
    }
  } catch (err) {
    console.error('send-artist-greenlight-notification error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
