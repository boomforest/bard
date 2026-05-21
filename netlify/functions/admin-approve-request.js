const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

// One-click approve link from JP's notification email. GET handler so it
// works as a plain `<a href>` — no JavaScript on JP's phone, no need to
// log into /admin.
//
//   GET /.netlify/functions/admin-approve-request?token=APPROVAL_TOKEN
//
// Behavior:
//   - Looks up promoter_requests by approval_token.
//   - If status != 'pending', renders an "already processed" page (idempotent
//     — clicking the link twice is safe).
//   - Otherwise creates a promoter_invites row (token = 32 hex bytes), flips
//     promoter_requests.status to 'invited', clears approval_token (single-
//     use), and triggers the existing send-promoter-invite email to the
//     applicant.
//   - Renders a confirmation HTML page so JP sees what just happened.
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return htmlResponse(405, errorPage('Method not allowed'))
  }

  const token = (event.queryStringParameters?.token || '').trim()
  if (!token) return htmlResponse(400, errorPage('Missing approval token'))

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    const { data: req, error: lookupErr } = await supabase
      .from('promoter_requests')
      .select('id, name, email, status')
      .eq('approval_token', token)
      .maybeSingle()
    if (lookupErr) throw lookupErr
    if (!req) return htmlResponse(404, errorPage('This approval link is no longer valid.'))

    if (req.status !== 'pending') {
      return htmlResponse(200, confirmPage(
        'Already processed',
        `${req.name}'s request was already ${req.status}. Nothing more to do.`,
      ))
    }

    // Generate a single-use invite token + insert promoter_invites row.
    const inviteToken = crypto.randomBytes(32).toString('hex')
    const { error: invErr } = await supabase
      .from('promoter_invites')
      .insert({
        token:      inviteToken,
        email:      req.email,
        request_id: req.id,
      })
    if (invErr) throw invErr

    // Flip status + clear the approval_token so a second click sees
    // 'already processed' instead of generating a duplicate invite.
    const { error: updErr } = await supabase
      .from('promoter_requests')
      .update({
        status:         'invited',
        reviewed_at:    new Date().toISOString(),
        approval_token: null,
      })
      .eq('id', req.id)
    if (updErr) throw updErr

    // Build the invite URL the same way PlatformAdmin does and fire the
    // applicant's invite email. Best-effort — the row is already inserted
    // so JP can still copy the link from /admin if Resend hiccups.
    const host = event?.headers?.host || 'grail.mx'
    const proto = host.startsWith('localhost') || host.startsWith('127.')
      ? 'http'
      : event?.headers?.['x-forwarded-proto'] || 'https'
    const origin = `${proto}://${host}`
    const inviteUrl = `${origin}/join?invite=${inviteToken}`

    let mailErr = null
    try {
      const res = await fetch(`${origin}/.netlify/functions/send-promoter-invite`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:      req.email,
          name:       req.name,
          invite_url: inviteUrl,
          origin,
        }),
      })
      if (!res.ok) mailErr = (await res.json().catch(() => ({}))).error || `${res.status}`
    } catch (e) {
      mailErr = e.message
    }

    return htmlResponse(200, confirmPage(
      'Approved · invite sent',
      mailErr
        ? `${req.name}'s invite is ready, but the email didn't go through (${escapeHtml(mailErr)}). Open /admin to copy the link manually.`
        : `Sent an invite link to ${escapeHtml(req.email)}. They'll click it, sign up, and land on /promoter ready to set up their first event.`,
    ))
  } catch (err) {
    console.error('admin-approve-request error:', err)
    return htmlResponse(500, errorPage(`Something went wrong: ${escapeHtml(err.message)}`))
  }
}

// ─── HTML helpers ───────────────────────────────────────────────────────

function htmlResponse(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body }
}

function shell(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · GRAIL</title>
<style>
  body { margin: 0; background: #08080c; color: #e8e0d0; font-family: -apple-system, system-ui, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .card { background: #0e0e14; border: 1px solid #1e1e2a; border-radius: 14px; padding: 32px 28px; max-width: 460px; width: 100%; }
  .eyebrow { font-size: 11px; color: #aaff00; text-transform: uppercase; letter-spacing: 0.15em; font-weight: 700; margin-bottom: 8px; }
  .eyebrow.err { color: #f07020; }
  h1 { margin: 0 0 12px 0; font-size: 1.5rem; letter-spacing: -0.02em; }
  p { margin: 0 0 12px 0; color: #c9c4d4; line-height: 1.6; }
  a { color: #aaff00; }
</style></head><body><div class="card">${body}</div></body></html>`
}
function confirmPage(title, body) {
  return shell(title, `<div class="eyebrow">${escapeHtml(title)}</div><h1>${escapeHtml(title)}</h1><p>${body}</p><p><a href="/admin">Open /admin →</a></p>`)
}
function errorPage(msg) {
  return shell('Error', `<div class="eyebrow err">Error</div><h1>Something's off</h1><p>${msg}</p><p><a href="/admin">Open /admin →</a></p>`)
}
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]))
}
