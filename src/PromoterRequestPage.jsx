import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from './supabase'
import { BRAND, C, FONT, INPUT, PRIMARY_BTN, PAGE, eyebrowStyle, LogoMark } from './theme'
import { useT } from './i18n'

export default function PromoterRequestPage() {
  const navigate = useNavigate()
  const t = useT()
  const [searchParams] = useSearchParams()
  const kind = searchParams.get('kind') === 'artist' ? 'artist' : 'promoter'
  const isArtist = kind === 'artist'

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
      setError(t('request.errMissing'))
      return
    }
    setLoading(true)
    try {
      const { data: inserted, error: insertErr } = await supabase
        .from('promoter_requests')
        .insert({ name, email, city: city || null, description: desc, kind })
        .select('id')
        .single()
      if (insertErr) throw insertErr

      // Best-effort notification email — don't block on it.
      fetch('/.netlify/functions/notify-promoter-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: inserted.id, name, email, city, description: desc, kind }),
      }).catch(() => {})

      setDone(true)
    } catch (err) {
      setError(err.message || t('request.errSubmit'))
    }
    setLoading(false)
  }

  // Copy varies by kind. Artist copy is hardcoded EN here (the existing
  // i18n keys cover promoter only); JP can extract to i18n later.
  const ART = {
    eyebrow:  'Apply — Artist',
    heading:  'Tell us about your set',
    body:     'Quick intro. We approve artists individually right now so the directory stays tight while we\'re early.',
    namePh:   'Your artist name (or full name)',
    cityPh:   'Where you\'re based (city)',
    descPh:   'Genre, where you\'ve played recently, links (SoundCloud / IG / etc.)',
    cta:      'Send application',
    doneHead: 'Got it.',
    doneBody: 'We\'ll review and email you at the address you gave. If we approve you, you\'ll get a link to set up your artist profile.',
    doneCta:  'Back to home',
  }
  const PROM = {
    eyebrow:  t('request.eyebrow'),
    heading:  t('request.heading'),
    body:     t('request.body'),
    namePh:   t('request.namePh'),
    cityPh:   t('request.cityPh'),
    descPh:   t('request.descPh'),
    cta:      t('request.cta'),
    doneHead: t('request.done.heading', { first: name.split(' ')[0] }),
    doneBody: t('request.done.body'),
    doneCta:  t('request.done.cta'),
  }
  const COPY = isArtist ? ART : PROM

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
            {t('common.back')}
          </button>
          <div style={LogoMark({ size: 32 })}>GRAIL</div>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🕊</div>
            <div style={{ ...eyebrowStyle(BRAND.neon) }}>{t('request.done.eyebrow')}</div>
            <div style={{ color: C.text, fontSize: '1.5rem', fontWeight: '900', letterSpacing: '-0.02em', marginBottom: '0.6rem' }}>
              {COPY.doneHead}
            </div>
            <div style={{ color: C.textMid, fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '2rem' }}>
              {COPY.doneBody}
            </div>
            <button onClick={() => navigate('/')} style={{ ...PRIMARY_BTN }}>
              {COPY.doneCta}
            </button>
          </div>
        ) : (
          <>
            <div style={eyebrowStyle(isArtist ? BRAND.pink : undefined)}>{COPY.eyebrow}</div>
            <div style={{ color: C.text, fontSize: '1.6rem', fontWeight: '900', letterSpacing: '-0.02em', marginBottom: '0.6rem', lineHeight: 1.2 }}>
              {COPY.heading}
            </div>
            <div style={{ color: C.textMid, fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              {COPY.body}
            </div>

            {!isArtist && (
              <div style={{
                background: 'rgba(240,112,32,0.06)', border: `1px solid ${BRAND.orange}55`,
                borderRadius: '12px', padding: '0.95rem 1.1rem', marginBottom: '1.5rem',
              }}>
                <div style={{ color: BRAND.orange, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 800, marginBottom: '0.4rem' }}>
                  How payments work
                </div>
                <div style={{ color: C.text, fontSize: '0.85rem', lineHeight: 1.55 }}>
                  Ticket revenue lands in your Stripe account at sale time, ready to spend on whatever the show needs — deposits, ice, DJ pay. Refunds before the show pull from that same account. If you've spent some of it already and don't have the balance to cover a refund, you'll need to top up from your bank to process it. That's normal — every promoter on every platform deals with this. We just want you to know up front.
                </div>
              </div>
            )}

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input style={INPUT} type="text" placeholder={COPY.namePh} value={name} onChange={e => setName(e.target.value)} required autoComplete="name" />
              <input style={INPUT} type="email" placeholder={t('common.email')} value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
              <input style={INPUT} type="text" placeholder={COPY.cityPh} value={city} onChange={e => setCity(e.target.value)} />
              <textarea
                placeholder={COPY.descPh}
                value={desc}
                onChange={e => setDesc(e.target.value)}
                rows={5}
                style={{ ...INPUT, resize: 'vertical', minHeight: '120px', lineHeight: 1.5 }}
                required
              />
              {error && <div style={{ color: BRAND.orange, fontSize: '0.82rem' }}>{error}</div>}
              <button type="submit" disabled={loading} style={{ ...PRIMARY_BTN, marginTop: '0.5rem', opacity: loading ? 0.6 : 1 }}>
                {loading ? t('request.sending') : COPY.cta}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
