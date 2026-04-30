import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { BRAND, C, FONT, INPUT, PAGE, eyebrowStyle, LogoMark } from './theme'
import { useT } from './i18n'
import LocaleToggle from './LocaleToggle'

// Lands here from the Supabase password-recovery email link.
//
// Supabase exchanges the URL hash tokens for a session automatically
// (the supabase-js client picks them up on import). After that, calling
// updateUser({ password }) lets the user set a new password.
//
// Three states:
//   - waiting: still resolving the session from the URL (brief)
//   - ready:   session resolved, show the new-password form
//   - bad:     no session, link expired or invalid

export default function ResetPassword() {
  const t = useT()
  const navigate = useNavigate()
  const [state, setState]       = useState('waiting')   // waiting | ready | bad
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      // Wait a tick for supabase-js to process the URL hash.
      await new Promise(r => setTimeout(r, 200))
      if (cancelled) return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setState('bad')
      } else {
        setState('ready')
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError(t('reset.tooShort')); return }
    if (password !== confirm) { setError(t('reset.mismatch')); return }
    setSaving(true)
    const { error: upErr } = await supabase.auth.updateUser({ password })
    if (upErr) { setError(upErr.message); setSaving(false); return }
    setSaving(false)
    setDone(true)
  }

  if (state === 'waiting') {
    return (
      <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '2rem', opacity: 0.4 }}>🕊</div>
      </div>
    )
  }

  if (state === 'bad') {
    return (
      <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '380px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🕊</div>
          <div style={{ color: C.text, fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.5rem' }}>
            {t('reset.expiredTitle')}
          </div>
          <div style={{ color: C.textMid, fontSize: '0.88rem', marginBottom: '1.5rem' }}>
            {t('reset.expiredBody')}
          </div>
          <button onClick={() => navigate('/me')} style={{
            background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '10px',
            padding: '0.85rem 1.5rem', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', fontFamily: FONT,
          }}>
            {t('reset.signIn')}
          </button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '380px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🕊</div>
          <div style={{ ...eyebrowStyle(BRAND.neon), marginBottom: '0.4rem' }}>{t('reset.doneEyebrow')}</div>
          <div style={{ color: C.text, fontSize: '1.2rem', fontWeight: '800', marginBottom: '1.5rem' }}>
            {t('reset.doneBody')}
          </div>
          <button onClick={() => navigate('/me')} style={{
            background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '10px',
            padding: '0.85rem 1.5rem', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', fontFamily: FONT,
          }}>
            {t('reset.continue')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.85rem', marginBottom: '1.5rem' }}>
          <div style={LogoMark({ size: 56 })}>GRAIL</div>
          <LocaleToggle />
        </div>
        <div style={{ ...eyebrowStyle(BRAND.purple), textAlign: 'center' }}>{t('reset.eyebrow')}</div>
        <div style={{ color: C.text, fontWeight: '800', fontSize: '1.4rem', textAlign: 'center', marginBottom: '0.4rem', letterSpacing: '-0.02em' }}>
          {t('reset.title')}
        </div>
        <div style={{ color: C.textMid, fontSize: '0.85rem', textAlign: 'center', marginBottom: '1.5rem' }}>
          {t('reset.minChars')}
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          <input
            type="password" autoComplete="new-password" required
            placeholder={t('reset.newPasswordPh')}
            value={password} onChange={e => setPassword(e.target.value)}
            style={INPUT}
          />
          <input
            type="password" autoComplete="new-password" required
            placeholder={t('reset.confirmPh')}
            value={confirm} onChange={e => setConfirm(e.target.value)}
            style={INPUT}
          />
          {error && <p style={{ fontSize: '0.82rem', color: BRAND.orange, margin: 0 }}>{error}</p>}
          <button type="submit" disabled={saving} style={{
            background: saving ? '#1a1a24' : BRAND.gradient,
            color: '#000', border: 'none', borderRadius: '10px',
            padding: '0.85rem', fontSize: '0.92rem', fontWeight: '800',
            cursor: saving ? 'wait' : 'pointer', fontFamily: FONT, marginTop: '0.25rem',
            opacity: saving ? 0.6 : 1,
          }}>
            {saving ? t('reset.updating') : t('reset.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}
