#!/usr/bin/env node
// Diff local .env against Netlify's env. Flags missing keys on either
// side so a deploy doesn't silently miss a new variable.
//
// Usage: npm run env:check
//
// Requires: `netlify` CLI installed and logged in (`netlify login`),
// plus a linked site (`netlify link`).

import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'

const ENV_FILE = '.env'

if (!existsSync(ENV_FILE)) {
  console.error(`No ${ENV_FILE} found in cwd.`)
  process.exit(1)
}

const localKeys = new Set(
  readFileSync(ENV_FILE, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => l.split('=')[0].trim())
    .filter(Boolean)
)

// `netlify env:list --json` returns {} when not logged in instead of
// erroring, and the CLI exits 0 even on auth errors — so we sniff the
// status string for "Not logged in".
const status = execSync('netlify status', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
if (/Not logged in/i.test(status)) {
  console.error('Netlify CLI not logged in.')
  console.error('  netlify login')
  console.error('  netlify link')
  process.exit(1)
}
if (!/Current project|Project Name/i.test(status)) {
  console.error('Netlify site not linked. Run: netlify link')
  process.exit(1)
}

let remoteKeys
try {
  const raw = execSync('netlify env:list --json', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  const parsed = JSON.parse(raw)
  remoteKeys = new Set(Object.keys(parsed))
} catch {
  console.error('Could not read Netlify env even though status passed. Try `netlify env:list` directly.')
  process.exit(1)
}

const missingOnNetlify = [...localKeys].filter(k => !remoteKeys.has(k))
const onlyOnNetlify    = [...remoteKeys].filter(k => !localKeys.has(k))

let problems = 0

if (missingOnNetlify.length) {
  console.log(`\nMissing on Netlify (${missingOnNetlify.length}):`)
  missingOnNetlify.forEach(k => console.log(`  - ${k}`))
  console.log('\nTo set:')
  missingOnNetlify.forEach(k => console.log(`  netlify env:set ${k} "$(grep ^${k}= ${ENV_FILE} | cut -d= -f2-)"`))
  problems += missingOnNetlify.length
}

if (onlyOnNetlify.length) {
  console.log(`\nOnly on Netlify, not in local ${ENV_FILE} (${onlyOnNetlify.length}):`)
  onlyOnNetlify.forEach(k => console.log(`  - ${k}`))
  console.log('Likely fine — these are vars the prod functions need but local dev doesn\'t.')
}

if (problems === 0 && onlyOnNetlify.length === 0) {
  console.log('✓ Local and Netlify env are in sync.')
} else if (problems === 0) {
  console.log(`\n✓ No missing keys on Netlify.`)
}

process.exit(problems > 0 ? 1 : 0)
