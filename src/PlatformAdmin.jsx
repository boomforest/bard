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
        {['requests', 'invite'].map(t => (
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
            {t === 'requests' ? 'Requests' : 'Generate Invite'}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {tab === 'requests' && <RequestsTab adminId={session.user.id} />}
        {tab === 'invite'   && <InviteTab   adminId={session.user.id} />}
      </div>
    </div>
  )
}

// ─── REQUESTS TAB ─────────────────────────────────────────────────────────────
function RequestsTab({ adminId }) {
  const [requests, setRequests] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [busy,     setBusy]     = useState('')
  const [created,  setCreated]  = useState({}) // { requestId: inviteUrl }

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('promoter_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    setRequests(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

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
      setCreated(c => ({ ...c, [req.id]: url }))

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
        const url = created[r.id]
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

            {url && (
              <div style={{ marginTop: '0.85rem', padding: '0.6rem 0.8rem', background: 'rgba(170,255,0,0.06)', border: `1px solid ${BRAND.neon}44`, borderRadius: '8px', fontSize: '0.78rem', color: BRAND.neon, wordBreak: 'break-all' }}>
                ✓ Copied to clipboard: <span style={{ color: C.text }}>{url}</span>
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
                  {busy === r.id ? '…' : 'Generate invite + copy link'}
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
