import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { BRAND, C, FONT, INPUT, PAGE, eyebrowStyle, LogoMark, badgeStyle } from './theme'

// Random URL-safe-ish token. 18 chars from base32 alphabet → ~90 bits.
function randomToken() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

const fmtWhen = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
         ' · ' +
         d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function PlatformAdmin() {
  const navigate = useNavigate()
  const [session, setSession] = useState(undefined)
  const [authzed, setAuthzed] = useState(null)  // null = checking
  const [tab, setTab]         = useState('requests')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (!session) { setAuthzed(false); return }
    let cancelled = false
    async function check() {
      const { data } = await supabase.from('users').select('is_admin').eq('id', session.user.id).maybeSingle()
      if (!cancelled) setAuthzed(!!data?.is_admin)
    }
    check()
    return () => { cancelled = true }
  }, [session])

  if (session === undefined || authzed === null) {
    return (
      <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '2rem', opacity: 0.4 }}>🕊</div>
      </div>
    )
  }

  if (!session || !authzed) {
    return (
      <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '380px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
          <div style={{ color: C.text, fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.5rem' }}>Admin only</div>
          <div style={{ color: C.textMid, fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            {session ? 'Your account does not have admin access.' : 'Sign in with an admin account.'}
          </div>
          <button onClick={() => navigate('/')} style={{
            background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '10px',
            padding: '0.85rem 1.5rem', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', fontFamily: FONT,
          }}>
            Home →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={PAGE}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 1.5rem', borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <button onClick={() => navigate('/')} style={{
            background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid,
            borderRadius: '6px', padding: '0.4rem 0.7rem', cursor: 'pointer',
            fontSize: '0.82rem', fontFamily: FONT,
          }}>←</button>
          <div style={LogoMark({ size: 30 })}>GRAIL</div>
          <span style={{ color: C.text, fontWeight: '700', fontSize: '0.9rem' }}>Admin</span>
        </div>
        <span style={{ color: C.textMid, fontSize: '0.82rem' }}>{session.user.email}</span>
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, padding: '0 1.5rem' }}>
        {[
          ['requests',    'Requests'],
          ['invite',      'Generate Invite'],
          ['subscribers', 'Subscribers'],
          ['errors',      'Errors'],
        ].map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              background: 'transparent', border: 'none',
              color: tab === t ? C.text : C.textDim,
              padding: '14px 18px', cursor: 'pointer',
              fontSize: '0.85rem', fontFamily: FONT,
              letterSpacing: '0.05em', fontWeight: '700',
              borderBottom: `2px solid ${tab === t ? BRAND.pink : 'transparent'}`,
              marginBottom: '-1px',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {tab === 'requests'    && <RequestsTab    adminId={session.user.id} />}
        {tab === 'invite'      && <InviteTab      adminId={session.user.id} />}
        {tab === 'subscribers' && <SubscribersTab adminId={session.user.id} />}
        {tab === 'errors'      && <ErrorsTab      adminId={session.user.id} />}
      </div>
    </div>
  )
}

// ─── REQUESTS TAB ─────────────────────────────────────────────────────────────
function RequestsTab({ adminId }) {
  const [requests, setRequests] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [busy,     setBusy]     = useState('')
  const [resent,   setResent]   = useState({}) // { requestId: true } — toast flag
  const [copied,   setCopied]   = useState({}) // { requestId: true } — toast flag

  // Fetch requests + the latest invite token per already-invited request, so
  // the link stays visible after a refresh (and admin can resend the email
  // without regenerating the token).
  const load = async () => {
    setLoading(true)
    const { data: reqs } = await supabase
      .from('promoter_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    const invitedIds = (reqs || []).filter(r => r.status === 'invited').map(r => r.id)
    const inviteByRequest = {}
    if (invitedIds.length > 0) {
      const { data: invs } = await supabase
        .from('promoter_invites')
        .select('request_id, token, created_at')
        .in('request_id', invitedIds)
        .order('created_at', { ascending: false })
      for (const inv of (invs || [])) {
        if (!inviteByRequest[inv.request_id]) inviteByRequest[inv.request_id] = inv.token
      }
    }

    setRequests((reqs || []).map(r => ({
      ...r,
      inviteToken: inviteByRequest[r.id] || null,
    })))
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const copyLink = (req, url) => {
    navigator.clipboard?.writeText(url)
    setCopied(c => ({ ...c, [req.id]: true }))
    setTimeout(() => setCopied(c => { const n = { ...c }; delete n[req.id]; return n }), 2000)
  }

  const resendEmail = async (req, url) => {
    setBusy(req.id)
    try {
      const res = await fetch('/.netlify/functions/send-promoter-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:      req.email,
          name:       req.name,
          invite_url: url,
          origin:     window.location.origin,
        }),
      })
      if (!res.ok) throw new Error(`Email failed: ${res.status}`)
      setResent(r => ({ ...r, [req.id]: true }))
      setTimeout(() => setResent(r => { const n = { ...r }; delete n[req.id]; return n }), 2500)
    } catch (err) {
      alert(err.message)
    }
    setBusy('')
  }

  const generateInvite = async (req) => {
    setBusy(req.id)
    try {
      const token = randomToken()
      const { error: invErr } = await supabase.from('promoter_invites').insert({
        token,
        email:      req.email,
        request_id: req.id,
        created_by: adminId,
      })
      if (invErr) throw invErr
      const url = `${window.location.origin}/join?invite=${token}`
      navigator.clipboard?.writeText(url)
      setCopied(c => ({ ...c, [req.id]: true }))
      setTimeout(() => setCopied(c => { const n = { ...c }; delete n[req.id]; return n }), 2000)

      await supabase
        .from('promoter_requests')
        .update({ status: 'invited', reviewed_at: new Date().toISOString(), reviewed_by: adminId })
        .eq('id', req.id)

      // Fire the invite email — best-effort, never blocks the success state.
      // The link is already on the clipboard if email delivery is delayed.
      try {
        await fetch('/.netlify/functions/send-promoter-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email:      req.email,
            name:       req.name,
            invite_url: url,
            origin:     window.location.origin,
          }),
        })
      } catch (mailErr) {
        console.warn('invite email failed (link still on clipboard):', mailErr)
      }

      load()
    } catch (err) {
      alert(err.message)
    }
    setBusy('')
  }

  const decline = async (req) => {
    if (!confirm(`Decline request from ${req.name}?`)) return
    setBusy(req.id)
    await supabase
      .from('promoter_requests')
      .update({ status: 'declined', reviewed_at: new Date().toISOString(), reviewed_by: adminId })
      .eq('id', req.id)
    setBusy('')
    load()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem 0', fontSize: '2rem', opacity: 0.4 }}>🕊</div>
  if (requests.length === 0) {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '3rem 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.6rem', opacity: 0.5 }}>🕊</div>
        <div style={{ color: C.text, fontSize: '1rem', fontWeight: '700', marginBottom: '0.3rem' }}>No requests yet.</div>
        <div style={{ color: C.textMid, fontSize: '0.85rem' }}>People can submit at /request-access.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {requests.map(r => {
        const inviteUrl = r.inviteToken ? `${window.location.origin}/join?invite=${r.inviteToken}` : null
        const status = r.status || 'pending'
        const variant = status === 'invited'  ? 'success'
                      : status === 'declined' ? 'neutral'
                      : status === 'redeemed' ? 'success'
                      : 'live'
        return (
          <div key={r.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <div style={{ color: C.text, fontWeight: '800', fontSize: '0.98rem' }}>{r.name}</div>
              <span style={badgeStyle(variant)}>{status}</span>
            </div>
            <div style={{ color: C.textMid, fontSize: '0.82rem', marginBottom: '0.3rem' }}>
              <a href={`mailto:${r.email}`} style={{ color: BRAND.pink, textDecoration: 'none' }}>{r.email}</a>
              {r.city && <span> · {r.city}</span>}
              <span> · {fmtWhen(r.created_at)}</span>
            </div>
            {r.description && (
              <div style={{ color: C.textMid, fontSize: '0.85rem', lineHeight: 1.55, marginTop: '0.6rem', whiteSpace: 'pre-wrap' }}>
                {r.description}
              </div>
            )}

            {inviteUrl && (
              <div style={{ marginTop: '0.85rem', padding: '0.6rem 0.8rem', background: 'rgba(170,255,0,0.06)', border: `1px solid ${BRAND.neon}44`, borderRadius: '8px', fontSize: '0.78rem', color: C.text, wordBreak: 'break-all' }}>
                {inviteUrl}
              </div>
            )}

            {status === 'pending' && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem' }}>
                <button
                  onClick={() => generateInvite(r)}
                  disabled={busy === r.id}
                  style={{
                    flex: 1, background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '8px',
                    padding: '0.6rem', fontSize: '0.82rem', fontWeight: '800',
                    cursor: busy === r.id ? 'wait' : 'pointer', fontFamily: FONT,
                  }}
                >
                  {busy === r.id ? '…' : 'Generate invite + email link'}
                </button>
                <button
                  onClick={() => decline(r)}
                  disabled={busy === r.id}
                  style={{
                    background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: '8px',
                    padding: '0.6rem 1rem', fontSize: '0.82rem', cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  Decline
                </button>
              </div>
            )}

            {status === 'invited' && inviteUrl && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem' }}>
                <button
                  onClick={() => copyLink(r, inviteUrl)}
                  style={{
                    flex: 1, background: 'transparent', color: C.text, border: `1px solid ${C.border}`, borderRadius: '8px',
                    padding: '0.6rem', fontSize: '0.82rem', fontWeight: '700',
                    cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  {copied[r.id] ? '✓ Copied' : 'Copy link'}
                </button>
                <button
                  onClick={() => resendEmail(r, inviteUrl)}
                  disabled={busy === r.id}
                  style={{
                    flex: 1, background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '8px',
                    padding: '0.6rem', fontSize: '0.82rem', fontWeight: '800',
                    cursor: busy === r.id ? 'wait' : 'pointer', fontFamily: FONT,
                  }}
                >
                  {busy === r.id ? '…' : resent[r.id] ? '✓ Email sent' : 'Resend email'}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── INVITE TAB (manual: just create an invite link without a request) ────────
function InviteTab({ adminId }) {
  const [email, setEmail] = useState('')
  const [busy,  setBusy]  = useState(false)
  const [url,   setUrl]   = useState('')
  const [error, setError] = useState('')

  const make = async (e) => {
    e.preventDefault()
    setError('')
    setUrl('')
    setBusy(true)
    try {
      const token = randomToken()
      const { error: insErr } = await supabase.from('promoter_invites').insert({
        token,
        email:      email || null,
        created_by: adminId,
      })
      if (insErr) throw insErr
      const u = `${window.location.origin}/join?invite=${token}`
      navigator.clipboard?.writeText(u)
      setUrl(u)

      // If an email was provided, fire the invite email. Best-effort —
      // link is already on clipboard regardless.
      if (email) {
        try {
          await fetch('/.netlify/functions/send-promoter-invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              invite_url: u,
              origin:     window.location.origin,
            }),
          })
        } catch (mailErr) {
          console.warn('invite email failed (link still on clipboard):', mailErr)
        }
      }
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '1.5rem' }}>
      <div style={eyebrowStyle()}>Manual invite</div>
      <div style={{ color: C.text, fontWeight: '800', fontSize: '1.1rem', marginBottom: '0.4rem', letterSpacing: '-0.01em' }}>
        Generate a one-off invite link
      </div>
      <div style={{ color: C.textMid, fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: 1.55 }}>
        Bypass the request flow. Email is optional — we use it to pre-fill signup if you provide one.
      </div>

      <form onSubmit={make} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <input style={INPUT} type="email" placeholder="Promoter email (optional)" value={email} onChange={e => setEmail(e.target.value)} />
        {error && <div style={{ color: BRAND.orange, fontSize: '0.82rem' }}>{error}</div>}
        <button type="submit" disabled={busy} style={{
          background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '10px',
          padding: '0.85rem', fontSize: '0.92rem', fontWeight: '800',
          cursor: busy ? 'wait' : 'pointer', fontFamily: FONT,
        }}>
          {busy ? '…' : 'Create invite link'}
        </button>
      </form>

      {url && (
        <div style={{ marginTop: '1.25rem', padding: '0.85rem 1rem', background: 'rgba(170,255,0,0.06)', border: `1px solid ${BRAND.neon}44`, borderRadius: '10px' }}>
          <div style={{ ...eyebrowStyle(BRAND.neon), marginBottom: '0.4rem' }}>Copied to clipboard</div>
          <div style={{ color: C.text, fontSize: '0.85rem', wordBreak: 'break-all', fontFamily: 'monospace' }}>{url}</div>
        </div>
      )}
    </div>
  )
}

// ─── ERRORS TAB ───────────────────────────────────────────────────────────────
// Shows the auto-reported error inbox. Anything caught by ErrorBoundary or the
// global window.onerror / unhandledrejection listeners lands here. Filter
// defaults to unresolved; toggle to see history.
// ─── SUBSCRIBERS TAB ──────────────────────────────────────────────────────────
// Grail+ (platform-level) and Casa de Copas (JP's personal parties) lists.
// Each opt-in writes to both; this tab lets admin view each list, see
// where subscribers came in from, copy emails, and export CSV.
function SubscribersTab({ adminId }) {
  const [list,    setList]    = useState('grail_plus')   // grail_plus | casa_de_copas
  const [rows,    setRows]    = useState(null)
  const [copied,  setCopied]  = useState(false)
  const [filter,  setFilter]  = useState('')             // free-text search

  useEffect(() => {
    let cancelled = false
    async function load() {
      setRows(null)
      const { data } = await supabase
        .from('subscribers')
        .select('id, email, name, zip, radius_miles, lang, source, opted_in_at, unsubscribed_at, created_at')
        .eq('list', list)
        .order('created_at', { ascending: false })
      if (!cancelled) setRows(data || [])
    }
    load()
    return () => { cancelled = true }
  }, [list])

  const visible = (rows || []).filter(r => {
    if (!filter.trim()) return true
    const q = filter.toLowerCase()
    return (r.email || '').toLowerCase().includes(q)
        || (r.name  || '').toLowerCase().includes(q)
        || (r.zip   || '').toLowerCase().includes(q)
        || (r.source|| '').toLowerCase().includes(q)
  })

  const active = visible.filter(r => !r.unsubscribed_at)

  const copyEmails = () => {
    const list = [...new Set(active.map(r => r.email).filter(Boolean))]
    if (list.length === 0) return
    navigator.clipboard?.writeText(list.join(', '))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const downloadCsv = () => {
    const header = ['email', 'name', 'zip', 'radius_miles', 'lang', 'source', 'opted_in_at']
    const escape = (v) => {
      if (v == null) return ''
      const s = String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [
      header.join(','),
      ...active.map(r => header.map(h => escape(r[h])).join(',')),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${list}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '0.25rem' }}>
        {[
          ['grail_plus',    'Grail+'],
          ['casa_de_copas', 'Casa de Copas'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setList(key)}
            style={{
              flex: 1, padding: '0.55rem', borderRadius: '7px', border: 'none',
              background: list === key ? BRAND.gradient : 'transparent',
              color: list === key ? '#000' : C.textMid,
              cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700',
              fontFamily: FONT,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {rows === null ? (
        <div style={{ color: C.textMid, fontSize: '0.85rem', padding: '2rem', textAlign: 'center' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '2.5rem 1.5rem', textAlign: 'center' }}>
          <div style={{ color: C.textMid, fontSize: '0.88rem' }}>
            No subscribers on this list yet. Buyers opt in from any event page checkout, waitlist, follow-promoter, or load-doves form.
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <input
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Search email / name / zip / source"
              style={{ ...INPUT, flex: 1, minWidth: '200px', fontSize: '0.85rem', padding: '0.55rem 0.85rem' }}
            />
            <button
              onClick={copyEmails}
              style={{
                background: 'transparent', color: copied ? BRAND.neon : C.text,
                border: `1px solid ${C.border}`, borderRadius: '8px',
                padding: '0.55rem 0.85rem', fontSize: '0.78rem', fontWeight: '700',
                cursor: 'pointer', fontFamily: FONT,
              }}
            >
              {copied ? '✓ Copied' : `Copy ${active.length} emails`}
            </button>
            <button
              onClick={downloadCsv}
              style={{
                background: 'transparent', color: C.text,
                border: `1px solid ${C.border}`, borderRadius: '8px',
                padding: '0.55rem 0.85rem', fontSize: '0.78rem', fontWeight: '700',
                cursor: 'pointer', fontFamily: FONT,
              }}
            >
              Export CSV
            </button>
          </div>

          <div style={{ color: C.textMid, fontSize: '0.78rem', marginBottom: '0.75rem' }}>
            {active.length} active{rows.length !== active.length ? ` · ${rows.length - active.length} unsubscribed` : ''}
            {filter && rows.length !== visible.length ? ` · ${visible.length} matching filter` : ''}
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', overflow: 'hidden' }}>
            {visible.map((r, i) => (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.85rem',
                padding: '0.7rem 1rem',
                borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                opacity: r.unsubscribed_at ? 0.45 : 1,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.text, fontWeight: '700', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.name || '—'}
                  </div>
                  <div style={{ color: C.textMid, fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.email}
                  </div>
                </div>
                <div style={{ flexShrink: 0, color: C.textDim, fontSize: '0.72rem', textAlign: 'right' }}>
                  {r.zip ? `${r.zip} · ${r.radius_miles}mi` : `${r.radius_miles}mi`}<br />
                  <span style={{ color: C.textMid }}>{r.source || '—'}</span> · {r.lang}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ErrorsTab({ adminId }) {
  const [errors,   setErrors]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [busy,     setBusy]     = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  const load = async () => {
    setLoading(true)
    let q = supabase
      .from('error_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (!showResolved) q = q.eq('resolved', false)
    const { data } = await q
    setErrors(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [showResolved]) // eslint-disable-line react-hooks/exhaustive-deps

  const markResolved = async (e, resolved) => {
    setBusy(e.id)
    await supabase
      .from('error_reports')
      .update({
        resolved,
        resolved_at: resolved ? new Date().toISOString() : null,
        resolved_by: resolved ? adminId : null,
      })
      .eq('id', e.id)
    await load()
    setBusy('')
  }

  const fmtWhen = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem 0', fontSize: '2rem', opacity: 0.4 }}>🕊</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ color: C.textMid, fontSize: '0.82rem' }}>
          {errors.length} {showResolved ? 'total' : 'unresolved'} error{errors.length === 1 ? '' : 's'}
        </div>
        <button
          onClick={() => setShowResolved(v => !v)}
          style={{
            background: 'transparent', border: 'none', color: C.textMid,
            fontSize: '0.78rem', cursor: 'pointer', fontFamily: FONT,
          }}
        >
          {showResolved ? 'Hide resolved' : 'Show resolved'}
        </button>
      </div>

      {errors.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '14px', padding: '3rem 2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.6rem', opacity: 0.5 }}>🕊</div>
          <div style={{ color: C.text, fontSize: '1rem', fontWeight: '700', marginBottom: '0.3rem' }}>
            {showResolved ? 'No errors recorded.' : 'No unresolved errors.'}
          </div>
          <div style={{ color: C.textMid, fontSize: '0.85rem' }}>The platform is quiet.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {errors.map(e => {
            const expanded = expandedId === e.id
            return (
              <div key={e.id} style={{
                background: C.card, border: `1px solid ${e.resolved ? C.border : BRAND.orange + '55'}`,
                borderRadius: '12px', overflow: 'hidden',
              }}>
                <button
                  onClick={() => setExpandedId(expanded ? null : e.id)}
                  style={{
                    width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
                    cursor: 'pointer', padding: '0.85rem 1.1rem', fontFamily: FONT, color: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem', gap: '0.5rem' }}>
                    <span style={{ color: e.resolved ? C.textMid : BRAND.orange, fontSize: '0.78rem', fontWeight: '700' }}>
                      {e.resolved ? 'resolved' : 'open'}
                    </span>
                    <span style={{ color: C.textMid, fontSize: '0.75rem' }}>{fmtWhen(e.created_at)}</span>
                  </div>
                  <div style={{ color: C.text, fontSize: '0.92rem', fontWeight: '700', marginBottom: '0.25rem', lineHeight: 1.4, wordBreak: 'break-word' }}>
                    {e.message || '(no message)'}
                  </div>
                  <div style={{ color: C.textMid, fontSize: '0.78rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {e.user_email && <span>{e.user_email}</span>}
                    {e.url && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px' }}>{e.url}</span>}
                  </div>
                </button>

                {expanded && (
                  <div style={{ padding: '0 1.1rem 1rem' }}>
                    {e.stack && (
                      <pre style={{
                        background: '#0a0a14', border: `1px solid ${C.border}`, borderRadius: '8px',
                        padding: '0.7rem 0.85rem', color: C.textMid, fontSize: '0.72rem',
                        lineHeight: 1.5, overflow: 'auto', maxHeight: '240px', whiteSpace: 'pre-wrap',
                        margin: '0 0 0.7rem',
                      }}>
                        {e.stack}
                      </pre>
                    )}
                    {e.context && (
                      <pre style={{
                        background: '#0a0a14', border: `1px solid ${C.border}`, borderRadius: '8px',
                        padding: '0.6rem 0.85rem', color: C.textMid, fontSize: '0.72rem',
                        lineHeight: 1.5, overflow: 'auto', maxHeight: '160px', whiteSpace: 'pre-wrap',
                        margin: '0 0 0.7rem',
                      }}>
                        {JSON.stringify(e.context, null, 2)}
                      </pre>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {!e.resolved ? (
                        <button
                          onClick={() => markResolved(e, true)}
                          disabled={busy === e.id}
                          style={{
                            flex: 1, background: BRAND.gradient, color: '#000', border: 'none',
                            borderRadius: '8px', padding: '0.55rem', fontSize: '0.8rem', fontWeight: '800',
                            cursor: busy === e.id ? 'wait' : 'pointer', fontFamily: FONT,
                          }}
                        >
                          {busy === e.id ? '…' : 'Mark resolved'}
                        </button>
                      ) : (
                        <button
                          onClick={() => markResolved(e, false)}
                          disabled={busy === e.id}
                          style={{
                            flex: 1, background: 'transparent', color: C.textMid,
                            border: `1px solid ${C.border}`, borderRadius: '8px',
                            padding: '0.55rem', fontSize: '0.8rem', fontWeight: '700',
                            cursor: busy === e.id ? 'wait' : 'pointer', fontFamily: FONT,
                          }}
                        >
                          {busy === e.id ? '…' : 'Reopen'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
