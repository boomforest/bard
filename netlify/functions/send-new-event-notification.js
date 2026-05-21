// Promoter-triggered "new event" blast. Emails everyone in
// promoter_followers when the promoter publishes a new event.
//
// Auth: Bearer access token of the promoter who owns the event.
// POST body: { event_id, origin? }
//
// Per-recipient language: each follower's `lang` column drives the
// email copy; falls back to ES if missing. The promoter doesn't pass
// a lang for the blast — it's not their preference, it's the
// follower's preference.
//
// Filtered by radius: followers_in_event_radius(event_id) RPC returns
// only the followers whose declared radius covers the event's venue.
// Falls back to "include the follower" when either side has no coords
// — over-deliver, never miss. Migration 033 added the helper; the
// geocode-zip function fills the lat/lng columns.

const { createClient } = require('@supabase/supabase-js')
const { t, pickLang } = require('./_lib/email-i18n.cjs')

const fmtDate = (iso, lang) => {
  if (!iso) return ''
  const tag = pickLang(lang) === 'es' ? 'es-MX' : 'en-US'
  return new Date(iso).toLocaleDateString(tag, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'America/Mexico_City',
  })
}

const escapeHtml = (s) =>
  String(s || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]))

const renderHtml = ({ promoterName, eventName, dateStr, venue, eventUrl, recipientName, L }) => `
  <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #08080c; color: #e8e0d0;">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #dd22aa 0%, #f07020 100%); line-height: 56px; color: #fff; font-weight: 900; font-size: 12px; letter-spacing: -0.02em;">GRAIL</div>
    </div>

    <div style="background: #12121a; border: 1px solid #1e1e2a; border-radius: 14px; padding: 24px; margin-bottom: 20px;">
      <div style="font-size: 11px; color: #aaff00; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; margin-bottom: 8px;">${escapeHtml(t(L, 'newEvent.eyebrow'))}</div>
      <div style="font-size: 22px; font-weight: 900; color: #e8e0d0; letter-spacing: -0.02em; margin-bottom: 12px;">${escapeHtml(eventName)}</div>
      <div style="color: #8a8098; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
        ${escapeHtml(dateStr)}${venue ? `<br>${escapeHtml(venue)}` : ''}
      </div>
      <div style="color: #c8c0d0; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
        ${escapeHtml(recipientName ? t(L, 'newEvent.greeting', { name: recipientName }) + ' ' : '')}${escapeHtml(t(L, 'newEvent.body', { promoter: promoterName }))}
      </div>
      <p style="margin: 14px 0 0;">
        <a href="${eventUrl}" style="display: inline-block; background: linear-gradient(135deg, #dd22aa 0%, #f07020 100%); color: #000; font-weight: 800; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-size: 14px;">${escapeHtml(t(L, 'newEvent.cta'))}</a>
      </p>
    </div>

    <div style="text-align: center; color: #3a3448; font-size: 11px; letter-spacing: 0.05em;">
      Powered by GRAIL · grail.mx<br>
      <span style="color: #8a8098;">${escapeHtml(t(L, 'newEvent.footer', { promoter: promoterName }))}</span>
    </div>
  </div>
`

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { event_id, origin } = JSON.parse(event.body || '{}')
    if (!event_id) throw new Error('event_id required')

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

    const { data: ev, error: evErr } = await admin
      .from('events')
      .select('id, slug, name, artist_name, show_date, doors_time, venue_hint, venue_address, promoter_id')
      .eq('id', event_id)
      .maybeSingle()
    if (evErr || !ev) throw new Error('Event not found')
    if (ev.promoter_id !== callerId) {
      const { data: callerRow } = await admin.from('users').select('is_admin').eq('id', callerId).maybeSingle()
      if (!callerRow?.is_admin) throw new Error('Not authorized for this event')
    }

    const { data: promoterRow } = await admin
      .from('users')
      .select('username, handle')
      .eq('id', ev.promoter_id)
      .maybeSingle()
    const promoterName = promoterRow?.username || promoterRow?.handle || 'A promoter'

    const { data: rows, error: flErr } = await admin
      .rpc('followers_in_event_radius', { p_event_id: ev.id })
    if (flErr) throw new Error(flErr.message)
    if (!rows || rows.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, sent: 0, total: 0, errors: [] }) }
    }

    const eventName = ev.name || ev.artist_name || 'New Event'
    const venue     = ev.venue_hint || ev.venue_address || ''
    const baseUrl   = origin || 'https://grail.mx'
    const eventUrl  = `${baseUrl}/e/${ev.slug}`
    const from      = process.env.EMAIL_FROM || 'GRAIL <tickets@casadecopas.com>'

    const sentIds = []
    const errors = []

    for (const row of rows) {
      try {
        const L = pickLang(row.lang)
        const dateStr = fmtDate(ev.show_date || ev.event_date, L)
        const subject = t(L, 'newEvent.subject', { promoter: promoterName })
        const html = renderHtml({
          promoterName,
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
        .from('promoter_followers')
        .update({ notified_at: new Date().toISOString() })
        .in('id', sentIds)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, sent: sentIds.length, total: rows.length, errors }),
    }
  } catch (err) {
    console.error('send-new-event-notification error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
