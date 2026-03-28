// netlify/functions/send-ticket-email.js

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { email, name, ticketIds, quantity, origin } = JSON.parse(event.body)

    const ticketLinks = ticketIds.map((id, i) =>
      `<p style="margin: 8px 0;"><a href="${origin}/t/${id}" style="color: #d2691e; font-size: 1.1rem;">🎟 Ticket ${i + 1} of ${quantity} — View &amp; Present at Door</a></p>`
    ).join('')

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Nonlinear <tickets@casadecopas.com>',
        to: email,
        subject: 'Your Nonlinear Tickets — April 11',
        html: `
          <div style="background:#1a0a00; color:#f5f5dc; font-family:system-ui,sans-serif; padding:2rem; max-width:500px; margin:0 auto; border-radius:12px;">
            <h1 style="color:#d2691e; font-size:2rem; margin:0 0 0.5rem 0;">NONLINEAR</h1>
            <p style="color:#cd853f; margin:0 0 2rem 0;">April 11, 2026 · 10PM — Sunrise · Less than 10 minutes from Condesa/Roma</p>
            <p style="margin:0 0 1rem 0;">Hi ${name},</p>
            <p style="margin:0 0 1.5rem 0;">Your ${quantity > 1 ? `${quantity} tickets are` : 'ticket is'} confirmed. Present the link${quantity > 1 ? 's' : ''} at the door — location revealed at midnight April 11.</p>
            ${ticketLinks}
            <hr style="border-color:#333; margin:2rem 0;" />
            <p style="color:#8b4513; font-size:0.85rem;">Each link is a unique ticket. Do not share publicly.</p>
          </div>
        `
      })
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Resend error:', err)
      return { statusCode: 500, body: JSON.stringify({ error: 'Email failed', details: err }) }
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) }

  } catch (err) {
    console.error('send-ticket-email error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
