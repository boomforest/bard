import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { BRAND, C, FONT, PAGE, eyebrowStyle, LogoMark } from './theme'

// Landing page Stripe redirects to after hosted onboarding finishes
// (or after a refresh / abandoned session). Asks the backend to refresh
// the user's Connect status, then routes back into the promoter flow.

export default function StripeReturn() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('checking') // checking | ready | incomplete | error
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) {
        if (!cancelled) {
          setStatus('error')
          setMessage('Sign in to finish connecting Stripe.')
        }
        return
      }

      try {
        const res = await fetch('/.netlify/functions/stripe-connect-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: session.user.id }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Could not check Stripe status')

        if (cancelled) return
        if (json.charges_enabled && json.details_submitted) {
          setStatus('ready')
          setTimeout(() => navigate('/promoter'), 1400)
        } else {
          setStatus('incomplete')
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setMessage(err.message)
        }
      }
    }
    check()
    return () => { cancelled = true }
  }, [navigate])

  return (
    <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ maxWidth: '380px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div style={LogoMark({ size: 56 })}>GRAIL</div>
        </div>
        <div style={eyebrowStyle()}>Stripe Connect</div>

        {status === 'checking' && (
          <>
            <div style={{ color: C.text, fontWeight: '800', fontSize: '1.3rem', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
              Checking your account…
            </div>
            <div style={{ color: C.textMid, fontSize: '0.9rem' }}>One moment.</div>
          </>
        )}

        {status === 'ready' && (
          <>
            <div style={{ color: BRAND.neon, fontWeight: '900', fontSize: '1.4rem', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
              ✓ You're connected
            </div>
            <div style={{ color: C.textMid, fontSize: '0.9rem' }}>Redirecting to your dashboard…</div>
          </>
        )}

        {status === 'incomplete' && (
          <>
            <div style={{ color: C.text, fontWeight: '800', fontSize: '1.2rem', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
              Onboarding incomplete
            </div>
            <div style={{ color: C.textMid, fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Stripe still needs a bit more info. Head back to your dashboard and click "Connect with Stripe" again to finish.
            </div>
            <button onClick={() => navigate('/promoter')} style={{
              background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '10px',
              padding: '0.85rem 1.5rem', fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer', fontFamily: FONT,
            }}>
              Back to dashboard
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ color: C.text, fontWeight: '800', fontSize: '1.2rem', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
              Something went wrong
            </div>
            <div style={{ color: BRAND.orange, fontSize: '0.9rem', marginBottom: '1.5rem' }}>{message}</div>
            <button onClick={() => navigate('/promoter')} style={{
              background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: '10px',
              padding: '0.75rem 1.5rem', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', fontFamily: FONT,
            }}>
              Back to dashboard
            </button>
          </>
        )}
      </div>
    </div>
  )
}
