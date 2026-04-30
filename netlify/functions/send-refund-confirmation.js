// Confirms a successful bar-tab refund to the buyer.
//
// POST body: { email, amount_cents, currency?, event_name? }
//
// Called best-effort from close-out-bar (manual) and auto-close-bar
// (scheduled) right after each successful Stripe refund. If sending
// fails, the close-out itself doesn't fail — the refund landed on
// Stripe's side either way.
//
// Required env: RESEND_API_KEY
// Optional env: EMAIL_FROM (defaults to "GRAIL <hello@casadecopas.com>")

const escapeHtml = (s) =>
  String(s || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]))

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { email, amount_cents, currency = 'mxn', event_name } = JSON.parse(event.body || '{}')
    if (!email) throw new Error('email required')
    if (typeof amount_cents !== 'number') throw new Error('amount_cents required')

    const code = String(currency || 'mxn').toUpperCase()
    const amount = (amount_cents / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })
    const fmtAmount = `${amount} ${code}`
    const eventLabel = event_name || 'the show'

    const subject = `Your refund — ${eventLabel}`

    const html = `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #0e0e14; color: #e8e0d0; border-radius: 14px;">
        <div style="font-size: 11px; color: #aaff00; text-transform: uppercase; letter-spacing: 0.18em; font-weight: 800; margin-bottom: 14px;">
          Refunded
        </div>
        <h2 style="margin: 0 0 18px 0; color: #e8e0d0; font-size: 1.45rem; letter-spacing: -0.02em; line-height: 1.25;">
          Your unspent doves are back on your card.
        </h2>
        <div style="background: #12121a; border: 1px solid #1e1e2a; border-radius: 12px; padding: 16px 18px; margin-bottom: 20px;">
          <div style="font-size: 11px; color: #8a8098; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; margin-bottom: 6px;">From</div>
          <div style="color: #e8e0d0; font-weight: 800; font-size: 16px; margin-bottom: 12px;">${escapeHtml(eventLabel)}</div>
          <div style="font-size: 11px; color: #8a8098; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; margin-bottom: 6px;">Amount</div>
          <div style="color: #aaff00; font-weight: 900; font-size: 22px; letter-spacing: -0.01em;">${fmtAmount}</div>
        </div>
        <p style="margin: 0 0 24px 0; color: #e8e0d0; font-size: 15px; line-height: 1.5;">Thanks for coming.</p>
        <hr style="border: none; border-top: 1px solid #1e1e2a; margin: 0 0 16px 0;" />
        <p style="margin: 0; color: #8a8098; font-size: 12px;">
          Questions? Reply to this email or write
          <a href="mailto:jp@casadecopas.com" style="color: #dd22aa; text-decoration: none;">jp@casadecopas.com</a>
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
        from:    process.env.EMAIL_FROM || 'GRAIL <hello@casadecopas.com>',
        to:      [email],
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
    console.error('send-refund-confirmation error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
