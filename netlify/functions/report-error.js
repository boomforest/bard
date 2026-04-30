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

    // Rate-limited admin heads-up email. We only ping if no other
    // error has landed in the last 30 minutes — keeps JP from getting
    // 100 emails when something starts cascading. The Errors inbox
    // remains the source of truth; this is just a "go look" nudge.
    await maybeNotifyAdmin(supabase, body.message)

    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  } catch (err) {
    console.error('report-error failed:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

async function maybeNotifyAdmin(supabase, latestMessage) {
  const notifyTo = process.env.ADMIN_NOTIFY_EMAIL
  const apiKey   = process.env.RESEND_API_KEY
  if (!notifyTo || !apiKey) return  // not configured — silent no-op

  try {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('error_reports')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', thirtyMinAgo)
    // count includes the one we just inserted, so > 1 means another
    // landed in the window already and we shouldn't double-ping.
    if ((count || 0) > 1) return

    const escape = (s) => String(s || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]))
    const preview = String(latestMessage || '').slice(0, 200)

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    process.env.EMAIL_FROM || 'GRAIL <hello@casadecopas.com>',
        to:      [notifyTo],
        subject: 'GRAIL error report landed',
        html: `
          <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; padding: 24px; background: #0e0e14; color: #e8e0d0; border-radius: 14px;">
            <div style="font-size: 11px; color: #f07020; text-transform: uppercase; letter-spacing: 0.18em; font-weight: 800; margin-bottom: 14px;">Error report</div>
            <h2 style="margin: 0 0 12px 0; font-size: 1.2rem;">An error just landed in your inbox.</h2>
            <pre style="background: #12121a; border: 1px solid #1e1e2a; border-radius: 8px; padding: 12px; color: #c8c0d0; font-size: 12px; white-space: pre-wrap; word-break: break-word; margin: 0 0 18px 0;">${escape(preview)}</pre>
            <p style="margin: 0;">
              <a href="https://grail.mx/admin" style="display: inline-block; background: linear-gradient(135deg, #dd22aa 0%, #f07020 100%); color: #000; font-weight: 800; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-size: 13px;">Open Errors inbox →</a>
            </p>
            <p style="margin: 16px 0 0 0; color: #8a8098; font-size: 11px;">
              Rate-limited: you'll only get one of these per 30-minute window. Check the inbox for the full list.
            </p>
          </div>
        `,
      }),
    })
  } catch (notifyErr) {
    // Never let the notification path block the actual error write.
    console.warn('admin error-notify failed (non-fatal):', notifyErr.message)
  }
}
