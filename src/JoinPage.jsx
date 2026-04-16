import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'

const C = {
  bg:       '#080808',
  surface:  '#0f0f0f',
  card:     '#131313',
  border:   '#1e1e1e',
  gold:     '#c8922a',
  goldLight:'#e8b84b',
  text:     '#f0ece4',
  textMid:  '#7a7060',
  textDim:  '#3a3028',
  red:      '#ef4444',
  purple:   '#b57bff',
}

const inp = {
  width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`,
  borderRadius: '8px', padding: '0.75rem 1rem', color: C.text,
  fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
}

const RADII = ['10', '25', '50', '100']

export default function JoinPage() {
  const [step, setStep]         = useState('auth') // auth | role | fan-setup
  const [authMode, setAuthMode] = useState('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [session, setSession]   = useState(null)
  const [zip, setZip]           = useState('')
  const [radius, setRadius]     = useState('25')
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) checkProfile(session)
    })
  }, [])

  const checkProfile = async (s) => {
    const { data } = await supabase.from('users').select('user_type').eq('id', s.user.id).single()
    if (data?.user_type === 'promoter') navigate('/promoter')
    else if (data?.user_type === 'fan')  navigate('/me')
    else { setSession(s); setStep('role') }
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const fn = authMode === 'login'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password })
      const { data, error } = await fn
      if (error) throw error
      if (data.session) {
        setSession(data.session)
        await checkProfile(data.session)
      } else {
        setError('Check your email to confirm your account.')
      }
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const selectRole = async (role) => {
    setLoading(true)
    if (role === 'promoter') {
      await supabase.from('users').upsert({
        id: session.user.id,
        email: session.user.email,
        username: session.user.email.split('@')[0].toUpperCase(),
        user_type: 'promoter',
      })
      navigate('/promoter')
    } else {
      setStep('fan-setup')
      setLoading(false)
    }
  }

  const handleFanSetup = async (e) => {
    e.preventDefault()
    setLoading(true)
    await supabase.from('users').upsert({
      id: session.user.id,
      email: session.user.email,
      username: session.user.email.split('@')[0].toUpperCase(),
      user_type: 'fan',
      zip_code: zip,
      radius_miles: parseInt(radius),
    })
    navigate('/me')
  }

  const wrap = (children) => (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <div style={{ color: C.goldLight, fontWeight: '900', fontSize: '1rem', letterSpacing: '-0.02em', marginBottom: '2rem', textAlign: 'center' }}>
          GRAIL
        </div>
        {children}
      </div>
    </div>
  )

  if (step === 'auth') return wrap(
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['login', 'signup'].map(m => (
          <button key={m} onClick={() => setAuthMode(m)} style={{
            flex: 1, padding: '0.6rem', borderRadius: '6px', border: `1px solid ${authMode === m ? C.goldLight : C.border}`,
            background: authMode === m ? 'rgba(232,184,75,0.08)' : 'transparent',
            color: authMode === m ? C.goldLight : C.textMid, cursor: 'pointer', fontSize: '0.85rem',
          }}>
            {m === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        ))}
      </div>
      <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <input style={inp} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        <input style={inp} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
        {error && <div style={{ color: C.red, fontSize: '0.82rem' }}>{error}</div>}
        <button type="submit" disabled={loading} style={{
          background: C.goldLight, color: '#000', border: 'none', borderRadius: '8px',
          padding: '0.85rem', fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer', marginTop: '0.25rem',
        }}>
          {loading ? '…' : authMode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </form>
      <button onClick={() => navigate('/')} style={{ display: 'block', margin: '1.5rem auto 0', background: 'transparent', border: 'none', color: C.textMid, cursor: 'pointer', fontSize: '0.82rem' }}>
        ← Back
      </button>
    </div>
  )

  if (step === 'role') return wrap(
    <div>
      <div style={{ color: C.text, fontWeight: '800', fontSize: '1.2rem', marginBottom: '0.4rem', textAlign: 'center' }}>Who are you?</div>
      <div style={{ color: C.textMid, fontSize: '0.85rem', textAlign: 'center', marginBottom: '2rem' }}>Choose your role</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <button onClick={() => selectRole('promoter')} style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px',
          padding: '1.25rem 1.5rem', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = C.goldLight}
          onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
        >
          <div style={{ color: C.goldLight, fontWeight: '800', fontSize: '1rem', marginBottom: '0.25rem' }}>I'm a Promoter</div>
          <div style={{ color: C.textMid, fontSize: '0.82rem' }}>Build your event, sell tickets, manage the bar</div>
        </button>
        <button onClick={() => selectRole('fan')} style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px',
          padding: '1.25rem 1.5rem', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.borderColor = C.purple}
          onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
        >
          <div style={{ color: C.purple, fontWeight: '800', fontSize: '1rem', marginBottom: '0.25rem' }}>I'm a Fan</div>
          <div style={{ color: C.textMid, fontSize: '0.82rem' }}>See your tickets, order drinks, find shows near you</div>
        </button>
      </div>
    </div>
  )

  if (step === 'fan-setup') return wrap(
    <div>
      <div style={{ color: C.text, fontWeight: '800', fontSize: '1.2rem', marginBottom: '0.4rem', textAlign: 'center' }}>Where do you go to shows?</div>
      <div style={{ color: C.textMid, fontSize: '0.85rem', textAlign: 'center', marginBottom: '2rem' }}>We'll use this to surface shows near you</div>
      <form onSubmit={handleFanSetup} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <input style={inp} type="text" placeholder="Zip code" value={zip} onChange={e => setZip(e.target.value)} required inputMode="numeric" />
        <div>
          <div style={{ color: C.textMid, fontSize: '0.78rem', marginBottom: '0.5rem' }}>How far will you travel?</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {RADII.map(r => (
              <button key={r} type="button" onClick={() => setRadius(r)} style={{
                flex: 1, padding: '0.6rem 0', borderRadius: '6px',
                border: `1px solid ${radius === r ? C.purple : C.border}`,
                background: radius === r ? 'rgba(181,123,255,0.1)' : 'transparent',
                color: radius === r ? C.purple : C.textMid,
                cursor: 'pointer', fontSize: '0.82rem',
              }}>
                {r}mi
              </button>
            ))}
          </div>
        </div>
        <button type="submit" disabled={loading || !zip} style={{
          background: C.purple, color: '#000', border: 'none', borderRadius: '8px',
          padding: '0.85rem', fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer', marginTop: '0.5rem',
          opacity: !zip ? 0.5 : 1,
        }}>
          {loading ? '…' : 'Enter Grail'}
        </button>
      </form>
    </div>
  )

  return null
}
