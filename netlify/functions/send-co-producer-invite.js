// Sends a co-producer invite email via Resend. Mirrors send-promoter-invite.js
// but with event-specific context (event name, role, split %, show date).
//
// POST body: { email, name, role, split_pct, event_name, event_slug, event_date, invite_url, origin }
//
// Required env: RESEND_API_KEY

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const {
      email, name, role, split_pct,
      event_name, event_slug, event_date,
      invite_url, origin,
    } = JSON.parse(event.body || '{}')
    if (!email || !invite_url) throw new Error('email and invite_url required')

    const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,'
    const site     = (origin || 'https://grail.mx').replace(/\/$/, '')
    const showName = escapeHtml(event_name || 'a GRAIL event')
    const dateLine = event_date
      ? new Date(event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : ''

    const html = `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #0e0e14; color: #e8e0d0; border-radius: 14px;">
        <div style="font-size: 11px; color: #dd22aa; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; margin-bottom: 8px;">GRAIL · Co-producer Invite</div>
        <h2 style="margin: 0 0 16px 0; color: #e8e0d0; font-size: 1.5rem; letter-spacing: -0.02em;">${greeting}</h2>
        <p style="margin: 0 0 16px 0; line-height: 1.55;">You've been invited to co-produce <strong style="color: #e8e0d0;">${showName}</strong>${dateLine ? ' on ' + dateLine : ''}.</p>
        <div style="background: #12121a; border: 1px solid #1e1e2a; border-radius: 10px; padding: 16px 18px; margin: 20px 0;">
          <div style="font-size: 11px; color: #8a8098; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;">Your role</div>
          <div style="color: #e8e0d0; font-weight: 700; font-size: 1.05rem; margin-bottom: 12px;">${escapeHtml(role || 'Producer')}</div>
          <div style="font-size: 11px; color: #8a8098; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;">Your share</div>
          <div style="color: #aaff00; font-weight: 800; font-size: 1.4rem;">${escapeHtml(String(split_pct ?? 0))}% of net</div>
        </div>
        <p style="margin: 0 0 16px 0; line-height: 1.55;">Click below to sign up for your own GRAIL account and review the contract. You'll see the agreed costs, splits, and revenue projection before you Greenlight.</p>
        <p style="margin: 24px 0;">
          <a href="${invite_url}" style="display: inline-block; background: linear-gradient(135deg, #dd22aa, #f07020); color: #fff; padding: 12px 24px; border-radius: 10px; font-weight: 800; text-decoration: none; letter-spacing: 0.02em;">Review the contract →</a>
        </p>
        <p style="margin: 0 0 12px 0; color: #8a8098; font-size: 13px; line-height: 1.5;">Or paste this URL into your browser:</p>
        <p style="margin: 0 0 24px 0; word-break: break-all; color: #aaff00; font-size: 13px;">${invite_url}</p>
        <hr style="border: none; border-top: 1px solid #1e1e2a; margin: 24px 0;" />
        <p style="margin: 0; color: #8a8098; font-size: 12px;">This invite is for ${escapeHtml(email)} only and is single-use. If you didn't expect this, ignore the email.</p>
        <p style="margin: 12px 0 0 0; color: #8a8098; font-size: 12px;"><a href="${site}" style="color: #8a8098;">${site}</a></p>
      </div>
    `

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    'GRAIL <hello@casadecopas.com>',
        to:      [email],
        subject: `Co-producer invite: ${event_name || 'GRAIL event'}`,
        html,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Resend error ${res.status}: ${body}`)
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  } catch (err) {
    console.error('send-co-producer-invite error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]))
}
