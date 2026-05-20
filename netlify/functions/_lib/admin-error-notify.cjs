// Shared admin-error notifier. Called from both error paths:
//   - report-error.js          (client-side errors via errorReporter.js)
//   - _lib/server-error-report (Netlify-function-side failures)
//
// Rate-limited: at most one email per 30-minute window across BOTH paths,
// so a cascading failure doesn't flood the inbox.
//
// Email body includes everything you'd want to triage without opening the
// dashboard: timestamp (CDMX + UTC), user, URL, browser, message, stack
// excerpt, context. Inbox is still the source of truth; this is the
// "go look — here's enough to know how urgent" nudge.
//
// Never throws — silent failure beats a crash inside the crash logger.

async function notifyAdminOfError(supabase, row) {
  const notifyTo = process.env.ADMIN_NOTIFY_EMAIL
  const apiKey   = process.env.RESEND_API_KEY
  if (!notifyTo || !apiKey) return

  try {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('error_reports')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', thirtyMinAgo)
    // count includes the row we just inserted, so > 1 means another
    // landed in the window already — skip the email, the first one
    // already nudged JP.
    if ((count || 0) > 1) return

    const html = renderEmail(row)
    const subject = renderSubject(row)

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    process.env.EMAIL_FROM || 'GRAIL <hello@casadecopas.com>',
        to:      [notifyTo],
        subject,
        html,
      }),
    })
  } catch (notifyErr) {
    console.warn('admin error-notify failed (non-fatal):', notifyErr.message)
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────

function escape(s) {
  return String(s || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]))
}

function truncate(s, n) {
  if (!s) return ''
  const str = String(s)
  return str.length > n ? str.slice(0, n) + '…' : str
}

// Tiny UA parser — gives JP "Chrome on macOS" instead of a 200-char string.
// Falls back to the raw UA if we can't recognize it.
function parseUA(ua) {
  if (!ua) return 'unknown'
  if (ua === 'netlify-function') return 'server (Netlify scheduled / synchronous function)'

  let browser = 'browser'
  if      (ua.includes('Edg/'))     browser = 'Edge'
  else if (ua.includes('OPR/'))     browser = 'Opera'
  else if (ua.includes('Chrome/'))  browser = 'Chrome'
  else if (ua.includes('Firefox/')) browser = 'Firefox'
  else if (ua.includes('Safari/'))  browser = 'Safari'

  let os = 'unknown OS'
  if      (ua.includes('iPhone'))                                 os = 'iPhone'
  else if (ua.includes('iPad'))                                   os = 'iPad'
  else if (ua.includes('Android'))                                os = 'Android'
  else if (ua.includes('Mac OS X') || ua.includes('Macintosh'))   os = 'macOS'
  else if (ua.includes('Windows'))                                os = 'Windows'
  else if (ua.includes('Linux'))                                  os = 'Linux'

  return `${browser} on ${os}`
}

// CDMX local time + UTC + relative ("2 minutes ago").
function formatWhen(iso) {
  const d = iso ? new Date(iso) : new Date()
  const cdmx = d.toLocaleString('en-US', {
    timeZone: 'America/Mexico_City',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const utc = d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'

  const secs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000))
  let relative
  if      (secs < 60)    relative = `${secs}s ago`
  else if (secs < 3600)  relative = `${Math.floor(secs / 60)} min ago`
  else if (secs < 86400) relative = `${Math.floor(secs / 3600)} hr ago`
  else                   relative = `${Math.floor(secs / 86400)} day(s) ago`

  return { cdmx: `${cdmx} CDMX`, utc, relative }
}

// First N non-empty lines of the stack, with leading whitespace preserved.
function stackExcerpt(stack, lines = 8) {
  if (!stack) return ''
  return String(stack)
    .split('\n')
    .filter(l => l.trim().length > 0)
    .slice(0, lines)
    .join('\n')
}

// ── subject + body ──────────────────────────────────────────────────────────

function renderSubject(row) {
  const where = row.user_agent === 'netlify-function' ? '[server]' : '[client]'
  const msg = truncate((row.message || 'Unknown error').replace(/\s+/g, ' '), 80)
  return `GRAIL error ${where} · ${msg}`
}

function renderEmail(row) {
  const when = formatWhen(row.created_at)
  const who  = row.user_email || (row.user_id ? `user_id: ${row.user_id}` : 'anonymous')
  const where = row.url || '(no url captured)'
  const ua = parseUA(row.user_agent)
  const message = truncate(row.message || 'Unknown error', 800)
  const stack = stackExcerpt(row.stack, 8)
  const context = row.context
    ? truncate(JSON.stringify(row.context, null, 2), 1200)
    : ''
  const adminUrl = 'https://grail.mx/admin'
  const idLine = row.id ? `report id: ${row.id}` : ''

  const fieldStyle = 'font-size: 11px; color: #f07020; text-transform: uppercase; letter-spacing: 0.16em; font-weight: 800; margin: 18px 0 4px 0;'
  const valueStyle = 'margin: 0; color: #d8d0c0; font-size: 13px; line-height: 1.45; word-break: break-word;'
  const codeBlock = 'background: #12121a; border: 1px solid #1e1e2a; border-radius: 8px; padding: 12px; color: #c8c0d0; font-size: 12px; white-space: pre-wrap; word-break: break-word; margin: 4px 0 0 0; font-family: ui-monospace, "SF Mono", Menlo, monospace;'

  return `
    <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 560px; padding: 24px; background: #0e0e14; color: #e8e0d0; border-radius: 14px;">
      <div style="font-size: 11px; color: #f07020; text-transform: uppercase; letter-spacing: 0.18em; font-weight: 800; margin-bottom: 6px;">Error report</div>
      <h2 style="margin: 0 0 4px 0; font-size: 1.2rem; line-height: 1.3;">${escape(truncate(row.message || 'Unknown error', 140))}</h2>
      <div style="color: #8a8098; font-size: 12px; margin: 0 0 6px 0;">${escape(when.relative)} · ${escape(when.cdmx)}</div>
      <div style="color: #6a6078; font-size: 11px; font-family: ui-monospace, Menlo, monospace; margin-bottom: 8px;">${escape(when.utc)}${idLine ? ' · ' + escape(idLine) : ''}</div>

      <div style="${fieldStyle}">Who</div>
      <p style="${valueStyle}">${escape(who)}</p>

      <div style="${fieldStyle}">Where</div>
      <p style="${valueStyle}"><a href="${escape(where)}" style="color: #f8c060; text-decoration: none; word-break: break-all;">${escape(where)}</a></p>

      <div style="${fieldStyle}">Browser</div>
      <p style="${valueStyle}">${escape(ua)}</p>

      <div style="${fieldStyle}">Message</div>
      <pre style="${codeBlock}">${escape(message)}</pre>

      ${stack ? `
        <div style="${fieldStyle}">Stack (first 8 lines)</div>
        <pre style="${codeBlock}">${escape(stack)}</pre>
      ` : ''}

      ${context ? `
        <div style="${fieldStyle}">Context</div>
        <pre style="${codeBlock}">${escape(context)}</pre>
      ` : ''}

      <p style="margin: 24px 0 0 0;">
        <a href="${adminUrl}" style="display: inline-block; background: linear-gradient(135deg, #dd22aa 0%, #f07020 100%); color: #000; font-weight: 800; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-size: 13px;">Open Errors inbox →</a>
      </p>

      <p style="margin: 18px 0 0 0; color: #8a8098; font-size: 11px;">
        Rate-limited: only one email per 30-minute window across all error sources. Check the inbox for the full list if a cascade is in progress.
      </p>
    </div>
  `
}

module.exports = { notifyAdminOfError }
