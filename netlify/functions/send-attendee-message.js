// Promoter → ticket-holder blast. Sends a free-form message to every
// non-refunded buyer for a given event, with a link back to their
// ticket. Used for "doors moved to 11pm", "bring a sweater", etc.
//
// Auth: Bearer access token of the promoter who owns the event.
// POST body: { event_id, subject, message, origin? }
//
// Per-recipient language pulled from tickets.lang. The message body is
// the promoter's prose and is sent as-is; chrome (eyebrow, greeting,
// footer, view-ticket CTA) is per-recipient i18n.

const { createClient } = require('@supabase/supabase-js')
const { t, pickLang } = require('./_lib/email-i18n.cjs')

const escapeHtml = (s) =>
  String(s || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]))

const renderHtml = ({ promoterName, eventName, message, ticketUrl, recipientName, L }) => `
  <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #08080c; color: #e8e0d0;">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #dd22aa 0%, #f07020 100%); line-height: 56px; color: #fff; font-weight: 900; font-size: 12px; letter-spacing: -0.02em;">GRAIL</div>
    </div>

    <div style="background: #12121a; border: 1px solid #1e1e2a; border-radius: 14px; padding: 24px; margin-bottom: 20px;">
      <div style="font-size: 11px; color: #dd22aa; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; margin-bottom: 8px;">${escapeHtml(t(L, 'attendeeMsg.eyebrow'))}</div>
      <div style="font-size: 22px; font-weight: 900; color: #e8e0d0; letter-spacing: -0.02em; margin-bottom: 12px;">${escapeHtml(eventName)}</div>
      <div style="color: #c8c0d0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; margin-bottom: 16px;">${escapeHtml(recipientName ? t(L, 'attendeeMsg.greeting', { name: recipientName }) + '\n\n' : '')}${escapeHtml(message)}</div>
      ${ticketUrl ? `<p style="margin: 14px 0 0;"><a href="${ticketUrl}" style="display: inline-block; background: linear-gradient(135deg, #dd22aa 0%, #f07020 100%); color: #000; font-weight: 800; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-size: 14px;">${escapeHtml(t(L, 'attendeeMsg.viewTicket'))}</a></p>` : ''}
    </div>

    <div style="text-align: center; color: #3a3448; font-size: 11px; letter-spacing: 0.05em;">
      Powered by GRAIL · grail.mx<br>
      <span style="color: #8a8098;">${escapeHtml(t(L, 'attendeeMsg.footer', { event: eventName }))}</span>
    </div>
  </div>
`

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { event_id, subject: rawSubject, message, origin } = JSON.parse(event.body || '{}')
    if (!event_id) throw new Error('event_id required')
    if (!message?.trim()) throw new Error('message required')

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

    const { data: promoterRow } = await admin
      .from('users')
      .select('username, handle')
      .eq('id', ev.promoter_id)
      .maybeSingle()
    const promoterName = promoterRow?.username || promoterRow?.handle || 'the promoter'

    // Pull all live (non-refunded) tickets for the event. Group by buyer
    // email so a buyer with multiple tickets only gets one email.
    const { data: tickets, error: tkErr } = await admin
      .from('tickets')
      .select('id, email, name, lang')
      .eq('event_id', event_id)
      .eq('refunded', false)
    if (tkErr) throw new Error(tkErr.message)
    if (!tickets || tickets.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, sent: 0, total: 0, errors: [] }) }
    }

    const grouped = new Map()
    for (const tk of tickets) {
      const key = (tk.email || '').toLowerCase()
      if (!key) continue
      if (!grouped.has(key)) {
        grouped.set(key, {
          email: tk.email,
          name:  tk.name,
          lang:  tk.lang,
          firstTicketId: tk.id,
        })
      }
    }

    const eventName = ev.name || ev.artist_name || 'Your Event'
    const baseUrl   = origin || 'https://grail.mx'
    const from      = process.env.EMAIL_FROM || 'GRAIL <tickets@casadecopas.com>'

    const sentEmails = []
    const errors = []

    for (const g of grouped.values()) {
      try {
        const L = pickLang(g.lang)
        const subject = rawSubject?.trim()
          || t(L, 'attendeeMsg.subject', { event: eventName, promoter: promoterName })
        const ticketUrl = g.firstTicketId ? `${baseUrl}/t/${g.firstTicketId}` : null
        const html = renderHtml({
          promoterName,
          eventName,
          message: message.trim(),
          ticketUrl,
          recipientName: g.name || '',
          L,
        })
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({ from, to: [g.email], subject, html }),
        })
        if (!res.ok) {
          const body = await res.text()
          errors.push({ email: g.email, error: `Resend ${res.status}: ${body.slice(0, 120)}` })
          continue
        }
        sentEmails.push(g.email)
      } catch (err) {
        errors.push({ email: g.email, error: err.message })
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, sent: sentEmails.length, total: grouped.size, errors }),
    }
  } catch (err) {
    console.error('send-attendee-message error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
