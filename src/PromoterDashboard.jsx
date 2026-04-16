import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import GrailSetup from './GrailSetup'

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
}

function LoginForm({ onLogin }) {
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

  const inp = {
    width: '100%', background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: '8px', padding: '0.75rem 1rem', color: C.text,
    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <div style={{ fontSize: '0.65rem', color: C.goldLight, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: '700', marginBottom: '0.4rem' }}>
          Promoter Portal
        </div>
        <div style={{ color: C.text, fontWeight: '800', fontSize: '1.4rem', marginBottom: '2rem' }}>
          Sign in to your account
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input style={inp} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input style={inp} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <div style={{ color: C.red, fontSize: '0.82rem' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{
            background: C.goldLight, color: '#000', border: 'none', borderRadius: '8px',
            padding: '0.85rem', fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer', marginTop: '0.5rem',
          }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function PromoterDashboard() {
  const [session, setSession] = useState(undefined)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (session === undefined) return null

  if (!session) return <LoginForm onLogin={setSession} />

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 1.5rem', borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ color: C.goldLight, fontWeight: '900', fontSize: '1rem', letterSpacing: '-0.02em' }}>
          GRAIL
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: C.textMid, fontSize: '0.82rem' }}>{session.user.email}</span>
          <button onClick={signOut} style={{
            background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid,
            borderRadius: '6px', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.78rem',
          }}>
            Sign out
          </button>
        </div>
      </div>
      <GrailSetup />
    </div>
  )
}
