// Promoter handle validation.
//
// Rules:
//   - 2–30 characters
//   - lowercase letters, digits, hyphens
//   - cannot start or end with a hyphen
//   - cannot collide with a reserved route or system word
//
// The reserved set must include every top-level route in main.jsx — if
// you add a new top-level route, add it here too or risk a promoter
// claiming a handle that breaks the app.

export const RESERVED_HANDLES = new Set([
  // Routes mounted in main.jsx
  'admin', 'request-access', 'scan', 'me', 'setup', 'promoter', 'join',
  'terms', 'e', 't', 'ticket', 'stripe', 'grail', 'demo', 'alleycat', 'bar',
  // Infrastructure paths
  'api', 'assets', 'static', 'public', 'favicon.ico', '_redirects', 'robots.txt',
  // Common reserved words people will try
  'home', 'index', 'www', 'mail', 'help', 'about', 'contact', 'privacy',
  'login', 'logout', 'signin', 'signup', 'register', 'auth', 'oauth',
  'profile', 'settings', 'account', 'dashboard', 'support',
])

const HANDLE_RE = /^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/

export function validateHandle(raw) {
  const handle = String(raw || '').trim().toLowerCase()
  if (!handle) return { ok: false, reason: 'Handle required.' }
  if (handle.length < 2) return { ok: false, reason: 'Too short (min 2 chars).' }
  if (handle.length > 30) return { ok: false, reason: 'Too long (max 30 chars).' }
  if (!HANDLE_RE.test(handle)) {
    return { ok: false, reason: 'Lowercase letters, numbers, hyphens only. No leading/trailing hyphen.' }
  }
  if (RESERVED_HANDLES.has(handle)) {
    return { ok: false, reason: 'That handle is reserved.' }
  }
  return { ok: true, handle }
}
