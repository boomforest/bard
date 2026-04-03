// netlify/functions/get-email-status.js
// Returns Resend delivery status for all Nonlinear ticket emails.
// Uses the read-capable key (RESEND_READ_KEY) — never exposed to the browser.

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const res = await fetch('https://api.resend.com/emails?limit=100', {
      headers: { 'Authorization': `Bearer ${process.env.RESEND_READ_KEY}` },
    })

    if (!res.ok) {
      const err = await res.text()
      return { statusCode: 502, body: JSON.stringify({ error: 'Resend error', details: err }) }
    }

    const { data } = await res.json()

    // Build a map: lowercase email → most recent last_event
    // (a buyer could have multiple sends; take the latest by created_at)
    const byEmail = {}
    for (const email of (data || [])) {
      const recipient = email.to?.[0]?.toLowerCase()
      if (!recipient) continue
      const existing = byEmail[recipient]
      if (!existing || email.created_at > existing.created_at) {
        byEmail[recipient] = {
          last_event: email.last_event,
          sent_at: email.created_at,
          email_id: email.id,
        }
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(byEmail),
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
