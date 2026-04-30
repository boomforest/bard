// Receives error reports from the client and writes them to the
// error_reports table via the service role.
//
// Why service role: the table's RLS policies only allow admin SELECT/
// UPDATE — there's no public INSERT policy, so anon clients can't
// directly populate the inbox. This function gives them a controlled
// path that captures user_id from the JWT (when present) so we know
// which signed-in account hit the error.
//
// POST body: { message, stack?, url?, userAgent?, context? }
// Auth header (optional): Bearer <supabase access token>

const { createClient } = require('@supabase/supabase-js')

const truncate = (s, n) => (s && typeof s === 'string') ? s.slice(0, n) : null

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    if (!body.message) {
      return { statusCode: 400, body: JSON.stringify({ error: 'message required' }) }
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    // Best-effort attach user identity from JWT
    let user_id = null
    let user_email = null
    const authHeader = event.headers.authorization || event.headers.Authorization || ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (jwt) {
      try {
        const { data } = await supabase.auth.getUser(jwt)
        if (data?.user) {
          user_id = data.user.id
          user_email = data.user.email || null
        }
      } catch {/* anonymous error reports are fine */}
    }

    const { error } = await supabase.from('error_reports').insert({
      user_id,
      user_email,
      message:    truncate(body.message,    2000),
      stack:      truncate(body.stack,      8000),
      url:        truncate(body.url,         500),
      user_agent: truncate(body.userAgent,   500),
      context:    body.context && typeof body.context === 'object' ? body.context : null,
    })
    if (error) throw error

    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  } catch (err) {
    console.error('report-error failed:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
