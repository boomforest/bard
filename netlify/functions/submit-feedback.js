exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { vibe_rating, sound_rating, heard_from, what_worked, what_didnt, come_back, anything_else, email } = JSON.parse(event.body)

    const res = await fetch('https://elkfhmyhiyyubtqzqlpq.supabase.co/rest/v1/feedback', {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        event: 'nonlinear-2026-04-11',
        vibe_rating,
        sound_rating,
        heard_from,
        what_worked,
        what_didnt,
        come_back,
        anything_else,
        email: email || null,
      })
    })

    if (!res.ok) {
      const err = await res.text()
      return { statusCode: 500, body: JSON.stringify({ error: err }) }
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
