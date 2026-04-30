// Single client-side entry point for posting errors to the inbox.
//
// Used by:
//   - <ErrorBoundary> (catches React render errors)
//   - window 'error' / 'unhandledrejection' listeners (catches everything else)
//   - Any catch block that wants to log a real production failure
//
// De-dupes the same error+url pair within 30s so a render-loop crash
// doesn't flood the inbox.

import { supabase } from './supabase'

let lastKey = null
let lastAt  = 0

export async function reportError(error, context = {}) {
  try {
    const message = error?.message || String(error || '') || 'Unknown error'
    const stack   = error?.stack || null
    const url       = typeof window !== 'undefined' ? window.location.href : null
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null

    const key = `${message}|${url}`
    const now = Date.now()
    if (key === lastKey && now - lastAt < 30_000) return
    lastKey = key
    lastAt = now

    let token = null
    try {
      const { data: { session } } = await supabase.auth.getSession()
      token = session?.access_token || null
    } catch {/* unauthenticated is fine */}

    await fetch('/.netlify/functions/report-error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message, stack, url, userAgent, context }),
    })
  } catch {
    // Never throw from the reporter itself — silent failure beats a
    // crash inside the crash handler.
  }
}

// Install once at app boot. Captures unhandled errors that escape React.
let installed = false
export function installGlobalErrorHandlers() {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', (e) => {
    // e.error is undefined for cross-origin script errors — fall back to message
    reportError(e.error || new Error(e.message || 'window.onerror'), {
      source: 'window.onerror',
      filename: e.filename || null,
      lineno:   e.lineno   || null,
      colno:    e.colno    || null,
    })
  })

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason
    const err = reason instanceof Error
      ? reason
      : new Error(typeof reason === 'string' ? reason : JSON.stringify(reason || 'Unhandled rejection'))
    reportError(err, { source: 'unhandledrejection' })
  })
}
