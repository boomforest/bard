import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { BRAND, C, FONT, INPUT, PRIMARY_BTN, PAGE, eyebrowStyle, LogoMark } from './theme'

export default function PromoterRequestPage() {
  const navigate = useNavigate()
  const [name,  setName]  = useState('')
  const [email, setEmail] = useState('')
  const [city,  setCity]  = useState('')
  const [desc,  setDesc]  = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done,  setDone]  = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim() || !email.trim() || !desc.trim()) {
      setError('Name, email, and a quick note about your events are required.')
      return
    }
    setLoading(true)
    try {
      const { error: insertErr } = await supabase
        .from('promoter_requests')
        .insert({ name, email, city: city || null, description: desc })
      if (insertErr) throw insertErr

      // Best-effort notification email — don't block on it.
      fetch('/.netlify/functions/notify-promoter-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, city, description: desc }),
      }).catch(() => {})

      setDone(true)
    } catch (err) {
      setError(err.message || 'Could not submit. Try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: '500px', height: '500px', pointerEvents: 'none',
        background: 'radial-gradient(ellipse, rgba(204,68,238,0.08) 0%, transparent 65%)',
      }} />

      <div style={{ width: '100%', maxWidth: '460px', position: 'relative', zIndex: 1 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <button onClick={() => navigate('/')} style={{
            background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid,
            borderRadius: '8px', padding: '0.4rem 0.85rem', fontSize: '0.82rem',
            cursor: 'pointer', fontFamily: FONT, fontWeight: '600',
          }}>
            ← Back
          </button>
          <div style={LogoMark({ size: 32 })}>GRAIL</div>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🕊</div>
            <div style={{ ...eyebrowStyle(BRAND.neon) }}>Received</div>
            <div style={{ color: C.text, fontSize: '1.5rem', fontWeight: '900', letterSpacing: '-0.02em', marginBottom: '0.6rem' }}>
              Thanks, {name.split(' ')[0]}.
            </div>
            <div style={{ color: C.textMid, fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '2rem' }}>
              JP gets your note as soon as you hit submit. If it's a fit, you'll get an invite link by email.
            </div>
            <button onClick={() => navigate('/')} style={{ ...PRIMARY_BTN }}>
              Back to home
            </button>
          </div>
        ) : (
          <>
            <div style={eyebrowStyle()}>Request Access</div>
            <div style={{ color: C.text, fontSize: '1.6rem', fontWeight: '900', letterSpacing: '-0.02em', marginBottom: '0.6rem', lineHeight: 1.2 }}>
              Tell us about your event.
            </div>
            <div style={{ color: C.textMid, fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
              GRAIL is invite-only while we onboard partners. Send a short note — JP reads every one.
            </div>

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input style={INPUT} type="text" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} required autoComplete="name" />
              <input style={INPUT} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
              <input style={INPUT} type="text" placeholder="City (optional)" value={city} onChange={e => setCity(e.target.value)} />
              <textarea
                placeholder="What kind of events do you throw? Frequency, size, the vibe…"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                rows={5}
                style={{ ...INPUT, resize: 'vertical', minHeight: '120px', lineHeight: 1.5 }}
                required
              />
              {error && <div style={{ color: BRAND.orange, fontSize: '0.82rem' }}>{error}</div>}
              <button type="submit" disabled={loading} style={{ ...PRIMARY_BTN, marginTop: '0.5rem', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Sending…' : 'Send request'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
