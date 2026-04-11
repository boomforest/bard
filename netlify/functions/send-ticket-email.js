// netlify/functions/send-ticket-email.js

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { email, name, ticketIds, quantity, origin, lang = 'en' } = JSON.parse(event.body)
    const es = lang === 'es'

    const ticketLinks = ticketIds.map((id, i) => {
      const url = `${origin}/t/${id}${es ? '?lang=es' : ''}`
      const label = es
        ? `🎟 Boleto ${i + 1} de ${quantity} — Ver y presentar en la entrada`
        : `🎟 Ticket ${i + 1} of ${quantity} — View & Present at Door`
      return `<p style="margin: 8px 0;"><a href="${url}" style="color: #d2691e; font-size: 1.1rem;">${label}</a></p>`
    }).join('')

    const subject = es
      ? 'Tus boletos para Nonlinear — 11 de Abril'
      : 'Your Nonlinear Tickets — April 11'

    const greeting = es ? `Hola ${name},` : `Hi ${name},`
    const body = es
      ? `${quantity > 1 ? `Tus ${quantity} boletos están` : 'Tu boleto está'} confirmado${quantity > 1 ? 's' : ''}. Presenta el enlace${quantity > 1 ? ' de cada boleto' : ''} en la entrada — la ubicación se revela a medianoche el 11 de abril.`
      : `Your ${quantity > 1 ? `${quantity} tickets are` : 'ticket is'} confirmed. Present the link${quantity > 1 ? 's' : ''} at the door — location revealed at midnight April 11.`
    const footer = es
      ? 'Cada enlace es un boleto único. No compartas públicamente.'
      : 'Each link is a unique ticket. Do not share publicly.'
    const dateTime = es ? '11 de Abril, 2026 · 10PM — Amanecer · Studio Olbrera — Álvarez de Icaza 13' : 'April 11, 2026 · 10PM — Sunrise · Studio Olbrera — Álvarez de Icaza 13'

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Nonlinear <tickets@casadecopas.com>',
        to: email,
        subject,
        html: `
          <div style="background:#1a0a00; color:#f5f5dc; font-family:system-ui,sans-serif; padding:2rem; max-width:500px; margin:0 auto; border-radius:12px;">
            <h1 style="color:#d2691e; font-size:2rem; margin:0 0 0.5rem 0;">NONLINEAR</h1>
            <p style="color:#cd853f; margin:0 0 2rem 0;">${dateTime}</p>
            <p style="margin:0 0 1rem 0;">${greeting}</p>
            <p style="margin:0 0 1.5rem 0;">${body}</p>
            ${ticketLinks}
            <hr style="border-color:#333; margin:2rem 0;" />
            <p style="color:#8b4513; font-size:0.85rem;">${footer}</p>
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
