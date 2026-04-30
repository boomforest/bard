// Promoter-triggered waitlist blast. Sends a free-form message + buy
// link to everyone on the event_waitlist for a given event, then stamps
// notified_at so the promoter can see who's been pinged.
//
// Auth: Bearer access token of the promoter who owns the event.
// POST body: { event_id, message, origin?, lang? }
//   `lang` is 'en' | 'es', default 'es'. Applies to the chrome (eyebrow,
//   CTA button, footer) only — the message body is the promoter's own
//   prose and is sent as-is.

const { createClient } = require('@supabase/supabase-js')
const { t, pickLang } = require('./_lib/email-i18n.cjs')

const escapeHtml = (s) =>
  String(s || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]))

const renderHtml = ({ eventName, message, eventUrl, recipientName, L }) => `
  <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #08080c; color: #e8e0d0;">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #dd22aa 0%, #f07020 100%); line-height: 56px; color: #fff; font-weight: 900; font-size: 12px; letter-spacing: -0.02em;">GRAIL</div>
    </div>

    <div style="background: #12121a; border: 1px solid #1e1e2a; border-radius: 14px; padding: 24px; margin-bottom: 20px;">
      <div style="font-size: 11px; color: #aaff00; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; margin-bottom: 8px;">${escapeHtml(t(L, 'waitlist.eyebrow'))}</div>
      <div style="font-size: 22px; font-weight: 900; color: #e8e0d0; letter-spacing: -0.02em; margin-bottom: 12px;">${escapeHtml(eventName)}</div>
      <div style="color: #c8c0d0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; margin-bottom: 16px;">${escapeHtml(recipientName ? t(L, 'waitlist.greeting', { name: recipientName }) + '\n\n' : '')}${escapeHtml(message)}</div>
      <p style="margin: 14px 0 0;">
        <a href="${eventUrl}" style="display: inline-block; background: linear-gradient(135deg, #dd22aa 0%, #f07020 100%); color: #000; font-weight: 800; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-size: 14px;">${escapeHtml(t(L, 'waitlist.cta'))}</a>
      </p>
    </div>

    <div style="text-align: center; color: #3a3448; font-size: 11px; letter-spacing: 0.05em;">
      Powered by GRAIL · grail.mx<br>
      <span style="color: #8a8098;">${escapeHtml(t(L, 'waitlist.footer'))}</span>
    </div>
  </div>
`

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { event_id, message, origin, lang } = JSON.parse(event.body || '{}')
    if (!event_id || !message?.trim()) throw new Error('event_id and message required')
    const L = pickLang(lang)

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
      .select('id, slug, name, artist_name, promoter_id')
      .eq('id', event_id)
      .maybeSingle()
    if (evErr || !ev) throw new Error('Event not found')
    if (ev.promoter_id !== callerId) {
      const { data: callerRow } = await admin.from('users').select('is_admin').eq('id', callerId).maybeSingle()
      if (!callerRow?.is_admin) throw new Error('Not authorized for this event')
    }

    const { data: rows, error: wlErr } = await admin
      .from('event_waitlist')
      .select('id, email, name, lang')
      .eq('event_id', event_id)
    if (wlErr) throw new Error(wlErr.message)
    if (!rows || rows.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, sent: 0, total: 0, errors: [] }) }
    }

    const eventName = ev.name || ev.artist_name || 'Your Event'
    const baseUrl = origin || 'https://grail.mx'
    const eventUrl = `${baseUrl}/e/${ev.slug}`
    const from = process.env.EMAIL_FROM || 'GRAIL <tickets@casadecopas.com>'

    const sentIds = []
    const errors = []

    for (const row of rows) {
      try {
        // Per-recipient language: use the lang they signed up with,
        // fall back to the promoter's blast lang, fall back to ES.
        const recipientL = pickLang(row.lang || lang)
        const subject = t(recipientL, 'waitlist.subject', { event: eventName })
        const html = renderHtml({
          eventName,
          message: message.trim(),
          eventUrl,
          recipientName: row.name || '',
          L: recipientL,
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
        .from('event_waitlist')
        .update({ notified_at: new Date().toISOString() })
        .in('id', sentIds)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, sent: sentIds.length, total: rows.length, errors }),
    }
  } catch (err) {
    console.error('send-waitlist-email error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
