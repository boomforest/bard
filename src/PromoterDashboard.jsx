import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import GrailSetup from './GrailSetup'
import PromoterEvents from './PromoterEvents'
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
        <PromoterEvents
          key={refreshKey}
          promoterId={session.user.id}
          onNew={() => setView('new')}
          onCheckStripe={startStripeOnboarding}
          stripeReady={stripeReady}
        />
      )}
      {view === 'new' && <GrailSetup />}
    </div>
  )
}
