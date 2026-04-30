// Server-side error reporter — counterpart to src/errorReporter.js.
//
// Netlify functions handle some errors gracefully and return them in the
// response body without throwing (e.g. close-out-bar collecting per-tab
// Stripe failures into an errors[] array, then returning 200 OK with the
// list). Those never trigger the client-side ErrorBoundary or
// window.onerror, so they previously skipped the /admin Errors inbox.
//
// Use this from any function's catch path to surface them anyway.
//
// Never throws — silent failure beats a crash inside the crash logger.

const { createClient } = require('@supabase/supabase-js')

async function reportServerError({
  message,
  stack       = null,
  context     = null,
  user_id     = null,
  user_email  = null,
  url         = null,
} = {}) {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    const truncate = (s, n) => (s && typeof s === 'string') ? s.slice(0, n) : null

    await supabase.from('error_reports').insert({
      user_id,
      user_email,
      message:    truncate(String(message || 'Unknown error'), 2000),
      stack:      truncate(stack && stack.toString ? stack.toString() : stack, 8000),
      url:        truncate(url, 500),
      user_agent: 'netlify-function',
      context:    context && typeof context === 'object' ? context : null,
    })
  } catch {/* never throw from the reporter */}
}

module.exports = { reportServerError }
