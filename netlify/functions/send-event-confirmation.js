// Generic ticket confirmation email — works for any event.
//
// POST body: { event_id, ticket_ids, buyer_email, buyer_name, origin }
//
// Required env: RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// optional EMAIL_FROM (defaults to "GRAIL <tickets@casadecopas.com>")

const { createClient } = require('@supabase/supabase-js')

const fmtDate = (iso) => {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'America/Mexico_City',
  })
}

const fmtTime = (timeStr, iso) => {
  if (timeStr) {
    const [h, m] = timeStr.split(':')
    const hour = parseInt(h, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const h12  = hour % 12 || 12
    return `${h12}:${m} ${ampm}`
  }
  if (iso) {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: 'America/Mexico_City',
    })
  }
  return ''
}

const escapeHtml = (s) =>
  String(s || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]))

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { event_id, ticket_ids, buyer_email, buyer_name, origin } = JSON.parse(event.body || '{}')
    if (!event_id || !buyer_email || !Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      throw new Error('event_id, buyer_email, and ticket_ids[] required')
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    const { data: ev, error: evErr } = await supabase
      .from('events')
      .select('id, slug, name, artist_name, show_date, doors_time, venue_hint, venue_address, flyer_url')
      .eq('id', event_id)
      .maybeSingle()
    if (evErr || !ev) throw new Error('Event not found')

    const eventName = ev.name || ev.artist_name || 'Your Event'
    const dateStr   = fmtDate(ev.show_date || ev.event_date)
    const timeStr   = fmtTime(ev.doors_time, ev.show_date || ev.event_date)
    const venue     = ev.venue_hint || ev.venue_address || ''

    const baseUrl = origin || 'https://grail.mx'
    const ticketLinks = ticket_ids.map((id, i) => {
      const url = `${baseUrl}/t/${id}`
      const label = ticket_ids.length === 1
        ? '🎟  View & Present at the Door'
        : `🎟  Ticket ${i + 1} of ${ticket_ids.length}`
      return `<p style="margin: 10px 0;"><a href="${url}" style="color: #f07020; font-size: 1.05rem; text-decoration: none; font-weight: 700;">${label}</a></p>`
    }).join('')

    const subject = `Your tickets — ${eventName}`

    const html = `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #08080c; color: #e8e0d0;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #dd22aa 0%, #f07020 100%); line-height: 56px; color: #fff; font-weight: 900; font-size: 12px; letter-spacing: -0.02em;">GRAIL</div>
        </div>

        <div style="background: #12121a; border: 1px solid #1e1e2a; border-radius: 14px; padding: 24px; margin-bottom: 20px;">
          <div style="font-size: 11px; color: #dd22aa; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; margin-bottom: 8px;">Confirmed</div>
          <div style="font-size: 22px; font-weight: 900; color: #e8e0d0; letter-spacing: -0.02em; margin-bottom: 8px;">${escapeHtml(eventName)}</div>
          <div style="color: #8a8098; font-size: 14px; line-height: 1.6;">
            ${escapeHtml(dateStr)}${timeStr ? ` · Doors ${escapeHtml(timeStr)}` : ''}<br>
            ${escapeHtml(venue)}
          </div>
        </div>

        <div style="background: #12121a; border: 1px solid #1e1e2a; border-radius: 14px; padding: 20px 24px; margin-bottom: 20px;">
          <div style="font-size: 11px; color: #8a8098; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; margin-bottom: 10px;">Hi ${escapeHtml(buyer_name || 'there')},</div>
          <div style="color: #e8e0d0; font-size: 15px; line-height: 1.6; margin-bottom: 14px;">
            Your ${ticket_ids.length > 1 ? `${ticket_ids.length} tickets are` : 'ticket is'} secured. Open ${ticket_ids.length > 1 ? 'each link' : 'this link'} on your phone at the door — staff scans the QR for entry.
          </div>
          ${ticketLinks}
        </div>

        <div style="text-align: center; color: #3a3448; font-size: 11px; letter-spacing: 0.05em;">
          Powered by GRAIL · grail.mx<br>
          <span style="color: #8a8098;">Each link is a unique ticket. Don't share publicly.</span>
        </div>
      </div>
    `

    const from = process.env.EMAIL_FROM || 'GRAIL <tickets@casadecopas.com>'

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from,
        to:      [buyer_email],
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Resend error ${res.status}: ${body}`)
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  } catch (err) {
    console.error('send-event-confirmation error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
