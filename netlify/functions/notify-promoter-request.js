// Sends an email to JP whenever someone submits the promoter access form.
//
// POST body: { name, email, city, description }
//
// Required env:
//   RESEND_API_KEY  (already used by send-ticket-email)
//   ADMIN_NOTIFY_EMAIL  (defaults to jp@casadecopas.com)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { name, email, city, description } = JSON.parse(event.body || '{}')
    if (!name || !email) throw new Error('name and email required')

    const to = process.env.ADMIN_NOTIFY_EMAIL || 'jp@casadecopas.com'
    const subject = `GRAIL · ${name} wants promoter access`

    const html = `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; padding: 24px; background: #0e0e14; color: #e8e0d0; border-radius: 14px;">
        <div style="font-size: 11px; color: #dd22aa; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; margin-bottom: 8px;">New Promoter Request</div>
        <h2 style="margin: 0 0 12px 0; color: #e8e0d0;">${escapeHtml(name)}</h2>
        <p style="margin: 0 0 6px 0;"><a href="mailto:${escapeHtml(email)}" style="color: #f07020;">${escapeHtml(email)}</a></p>
        ${city ? `<p style="margin: 0 0 18px 0; color: #8a8098;">${escapeHtml(city)}</p>` : ''}
        <div style="background: #12121a; border: 1px solid #1e1e2a; border-radius: 10px; padding: 14px 16px; color: #e8e0d0; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(description || '')}</div>
        <p style="margin: 24px 0 0 0; color: #8a8098; font-size: 13px;">
          Open <a href="https://grail.mx/admin" style="color: #aaff00;">grail.mx/admin</a> to review and send an invite.
        </p>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:     'GRAIL <hello@casadecopas.com>',
        to:       [to],
        reply_to: email,
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
    console.error('notify-promoter-request error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]))
}
