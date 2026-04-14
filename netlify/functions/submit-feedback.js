const SUPABASE_URL = 'https://elkfhmyhiyyubtqzqlpq.supabase.co'

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { vibe_rating, sound_rating, heard_from, what_worked, what_didnt, come_back, anything_else, email, password, auth_mode } = JSON.parse(event.body)
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY

    // Save feedback
    const feedbackRes = await fetch(`${SUPABASE_URL}/rest/v1/feedback`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        event: 'nonlinear-2026-04-11',
        vibe_rating, sound_rating, heard_from,
        what_worked, what_didnt, come_back, anything_else,
        email: email || null,
      })
    })

    if (!feedbackRes.ok) {
      const err = await feedbackRes.text()
      return { statusCode: 500, body: JSON.stringify({ error: err }) }
    }

    // Create or login to Grail account if email + password provided
    let accountCreated = false
    if (email && password) {
      if (auth_mode === 'login') {
        const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            'apikey': key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password })
        })
        accountCreated = loginRes.ok ? 'exists' : false
      } else {
        const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
          method: 'POST',
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            email_confirm: true,
            user_metadata: { source: 'nonlinear-feedback', promo_code: 'NLNR10' }
          })
        })

        if (authRes.ok) {
          accountCreated = true
        } else {
          const authErr = await authRes.json()
          accountCreated = authErr.code === 'email_exists' ? 'exists' : false
        }
      }
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, accountCreated }) }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
