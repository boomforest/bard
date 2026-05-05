import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import GrailSetup from './GrailSetup'
import PromoterEvents from './PromoterEvents'
import OnboardingWizard from './OnboardingWizard'
import { BRAND, C, FONT, INPUT, PRIMARY_BTN, PAGE, eyebrowStyle, LogoMark } from './theme'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
        width: '500px', height: '500px', pointerEvents: 'none',
        background: 'radial-gradient(ellipse, rgba(204,68,238,0.08) 0%, transparent 65%)',
      }} />
      <div style={{ width: '100%', maxWidth: '380px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div style={LogoMark({ size: 56 })}>GRAIL</div>
        </div>
        <div style={{ ...eyebrowStyle(), textAlign: 'center' }}>Promoter Portal</div>
        <div style={{ color: C.text, fontWeight: '800', fontSize: '1.4rem', textAlign: 'center', marginBottom: '2rem', letterSpacing: '-0.02em' }}>
          Sign in to your account
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <input style={INPUT} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input style={INPUT} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <div style={{ color: BRAND.orange, fontSize: '0.82rem' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ ...PRIMARY_BTN, marginTop: '0.5rem' }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!email.trim()) { setError('Enter your email above first.'); return }
              setError('')
              const { error: rErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: `${window.location.origin}/reset-password`,
              })
              setError(rErr ? rErr.message : 'Reset link sent — check your email.')
            }}
            style={{
              background: 'transparent', border: 'none', color: C.textMid,
              fontSize: '0.78rem', cursor: 'pointer', padding: '0.2rem 0',
              fontFamily: FONT,
            }}
          >
            Forgot password?
          </button>
        </form>
      </div>
    </div>
  )
}

export default function PromoterDashboard() {
  const [session, setSession] = useState(undefined)
  const [view, setView]       = useState('events')   // events | new
  const [stripeReady, setStripeReady] = useState(null)  // null = unknown, false/true once checked
  const [refreshKey, setRefreshKey] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // Check Stripe Connect status whenever we land on the events view
  useEffect(() => {
    if (!session?.user?.id || view !== 'events') return
    let cancelled = false
    async function check() {
      try {
        const res = await fetch('/.netlify/functions/stripe-connect-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: session.user.id }),
        })
        const json = await res.json()
        if (!cancelled) setStripeReady(!!(json.charges_enabled && json.details_submitted))
      } catch {
        if (!cancelled) setStripeReady(false)
      }
    }
    check()
    return () => { cancelled = true }
  }, [session, view, refreshKey])

  const startStripeOnboarding = async () => {
    if (!session?.user?.id) return
    try {
      const res = await fetch('/.netlify/functions/stripe-connect-onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: session.user.id,
          email:   session.user.email,
          origin:  window.location.origin,
        }),
      })
      const json = await res.json()
      if (json.url) window.location.href = json.url
      else alert(json.error || 'Could not start Stripe onboarding')
    } catch (err) {
      alert(err.message)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (session === undefined) return null
  if (!session) return <LoginForm />

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
          }}>
            ←
          </button>
          <div style={LogoMark({ size: 30 })}>GRAIL</div>
          <span style={{ color: C.text, fontWeight: '700', fontSize: '0.9rem' }}>GRAIL</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {view === 'new' && (
            <button onClick={() => { setView('events'); setRefreshKey(k => k + 1) }} style={{
              background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid,
              borderRadius: '6px', padding: '0.4rem 0.85rem', cursor: 'pointer',
              fontSize: '0.78rem', fontFamily: FONT,
            }}>
              ← My Events
            </button>
          )}
          <span style={{ color: C.textMid, fontSize: '0.82rem' }}>{session.user.email}</span>
          <button onClick={signOut} style={{
            background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid,
            borderRadius: '6px', padding: '0.4rem 0.9rem', cursor: 'pointer',
            fontSize: '0.78rem', fontFamily: FONT,
          }}>
            Sign out
          </button>
        </div>
      </div>

      {view === 'events' && (
        <>
          <OnboardingWizard
            key={refreshKey}
            promoterId={session.user.id}
            stripeReady={stripeReady}
            onConnectStripe={startStripeOnboarding}
            onCreateEvent={() => setView('new')}
          />
          <FollowersStrip promoterId={session.user.id} />
          <PromoterEvents
            key={refreshKey}
            promoterId={session.user.id}
            onNew={() => setView('new')}
            onCheckStripe={startStripeOnboarding}
            stripeReady={stripeReady}
          />
        </>
      )}
      {view === 'new' && <GrailSetup />}
    </div>
  )
}

// ─── FOLLOWERS STRIP ─────────────────────────────────────────────────────────
// Compact card showing how many people are subscribed to this promoter's
// announcements. Click to expand the list (emails + zip + radius).
function FollowersStrip({ promoterId }) {
  const [followers, setFollowers] = useState(null)   // null while loading
  const [expanded,  setExpanded]  = useState(false)
  const [copied,    setCopied]    = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('promoter_followers')
        .select('id, email, name, zip, radius_miles, notified_at, created_at')
        .eq('promoter_id', promoterId)
        .order('created_at', { ascending: false })
      if (!cancelled) setFollowers(data || [])
    }
    load()
    return () => { cancelled = true }
  }, [promoterId])

  const copyEmails = () => {
    const list = [...new Set((followers || []).map(f => f.email).filter(Boolean))]
    if (list.length === 0) return
    navigator.clipboard?.writeText(list.join(', '))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (followers === null || followers.length === 0) return null

  return (
    <div style={{ padding: '1rem 1.5rem 0' }}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: '12px', padding: '0.85rem 1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              background: 'transparent', border: 'none', color: C.text,
              cursor: 'pointer', fontFamily: FONT, fontSize: '0.85rem',
              fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: 0,
            }}
          >
            <span style={{ color: BRAND.neon }}>{followers.length}</span>
            <span style={{ color: C.textMid, fontWeight: '600' }}>
              {followers.length === 1 ? 'follower' : 'followers'} · auto-emailed when you create new events
            </span>
            <span style={{ color: C.textDim }}>{expanded ? '▴' : '▾'}</span>
          </button>
          {expanded && (
            <button
              onClick={copyEmails}
              style={{
                background: 'transparent', color: copied ? BRAND.neon : C.textMid,
                border: `1px solid ${C.border}`, borderRadius: '6px',
                padding: '0.3rem 0.7rem', fontSize: '0.72rem', fontWeight: '700',
                cursor: 'pointer', fontFamily: FONT,
              }}
            >
              {copied ? '✓ Copied' : 'Copy emails'}
            </button>
          )}
        </div>

        {expanded && (
          <div style={{ marginTop: '0.75rem', borderTop: `1px solid ${C.border}`, paddingTop: '0.75rem' }}>
            {followers.map(f => (
              <div key={f.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.4rem 0', fontSize: '0.8rem',
              }}>
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: C.text, fontWeight: '700' }}>{f.name || '—'}</span>
                  <span style={{ color: C.textMid, marginLeft: '0.5rem' }}>{f.email}</span>
                </div>
                <div style={{ color: C.textDim, fontSize: '0.72rem', flexShrink: 0, marginLeft: '0.6rem' }}>
                  {f.zip ? `${f.zip} · ${f.radius_miles}mi` : `${f.radius_miles}mi`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
