const { createClient } = require('@supabase/supabase-js')
const { reportServerError } = require('./_lib/server-error-report.cjs')

// Weekly Supabase snapshot. Calls public.backup_all_tables() — a Postgres
// function that returns one JSONB object keyed by table name — and PUTs the
// result to a private GitHub repo (default: boomforest/bard-backups).
//
// Cadence (per netlify.toml):  0 6 * * 0   (Sundays 06:00 UTC)
//
// Schema lives in supabase/*.sql. Recovery path:
//   1. Provision a fresh Supabase project (or reset)
//   2. Run migrations 001..NNN in order
//   3. For each table in the snapshot JSON, INSERT the rows
//
// Required env (set on Netlify):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   BACKUPS_GH_TOKEN     fine-grained PAT, contents:write on bard-backups only
//   BACKUPS_REPO         optional, defaults to "boomforest/bard-backups"

exports.handler = async () => {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    const { data: dump, error } = await supabase.rpc('backup_all_tables')
    if (error) throw error
    if (!dump) throw new Error('backup_all_tables() returned null')

    const tableCount = Object.keys(dump).length
    const stamp = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const path  = `data/${stamp}.json`

    const token = process.env.BACKUPS_GH_TOKEN
    if (!token) throw new Error('BACKUPS_GH_TOKEN not set')
    const repo  = process.env.BACKUPS_REPO || 'boomforest/bard-backups'

    const body = {
      message: `Weekly backup ${stamp} (${tableCount} tables)`,
      content: Buffer.from(JSON.stringify(dump, null, 2)).toString('base64'),
    }

    // PUT creates a new file. If a same-day backup already exists, GitHub
    // returns 422 — fetch its sha and PUT again with the sha to overwrite.
    let res = await ghPut(repo, path, body, token)
    if (res.status === 422) {
      const existing = await ghGet(repo, path, token)
      if (existing.sha) {
        res = await ghPut(repo, path, { ...body, sha: existing.sha }, token)
      }
    }
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`GitHub PUT ${res.status}: ${text.slice(0, 300)}`)
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, path, tables: tableCount, bytes: body.content.length }),
    }
  } catch (err) {
    console.error('weekly-backup error:', err)
    await reportServerError({
      message: `weekly-backup failed: ${err.message}`,
      stack:   err.stack,
      context: { fn: 'weekly-backup', cadence: '0 6 * * 0' },
    })
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}

async function ghPut(repo, path, body, token) {
  return fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    method:  'PUT',
    headers: ghHeaders(token),
    body:    JSON.stringify(body),
  })
}

async function ghGet(repo, path, token) {
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    headers: ghHeaders(token),
  })
  if (!res.ok) return {}
  return res.json()
}

function ghHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept':        'application/vnd.github+json',
    'Content-Type':  'application/json',
    'User-Agent':    'minstrel-weekly-backup',
  }
}
