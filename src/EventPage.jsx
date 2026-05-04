import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { fmtPriceCents } from './currencies'
import { BRAND, C, FONT, INPUT, PAGE, eyebrowStyle, LogoMark, badgeStyle } from './theme'
import { useT, useLocale } from './i18n'
import LocaleToggle from './LocaleToggle'
import GrailOptIn from './GrailOptIn'
import { subscribeToLists } from './eventService'

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null

const localeTag = (l) => (l === 'es' ? 'es-MX' : 'en-US')

const fmtDate = (iso, locale = 'es') => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString(localeTag(locale), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

const fmtTime = (timeStr) => {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12  = hour % 12 || 12
  return `${h12}:${m} ${ampm}`
}

// Use fmtPriceCents from currencies.js — keeps the currency code visible
// so $50 MXN never gets confused with $50 USD.

// Build an RFC-5545 .ics file in memory and trigger a download. Apple/Google
// Calendar both consume this; this saves the buyer typing the date in.
// Defaults end-time to 6h after start since most shows don't publish one.
function downloadIcs(event, locale = 'en') {
  const start = event?.show_date || event?.event_date
  if (!start) return
  const startDate = new Date(start)
  const endDate = new Date(startDate.getTime() + 6 * 60 * 60 * 1000)
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const fold = (s) => s.replace(/(.{72})/g, '$1\r\n ')
  const esc  = (s) => (s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
  const name = event.name || event.artist_name || 'Event'
  const where = event.venue_hint || event.venue_address || event.address || ''
  const uid = `${event.id || event.slug}-${fmt(startDate)}@grail.mx`
  const url = typeof window !== 'undefined' ? `${window.location.origin}/e/${event.slug}` : ''
  const desc = [event.description || '', url].filter(Boolean).join('\\n\\n')
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Grail//Tickets//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(startDate)}`,
    `DTEND:${fmt(endDate)}`,
    fold(`SUMMARY:${esc(name)}`),
    where ? fold(`LOCATION:${esc(where)}`) : null,
    desc ? fold(`DESCRIPTION:${desc}`) : null,
    url ? `URL:${url}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = `${event.slug || 'event'}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(href)
}

export default function EventPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const t = useT()
  const { locale } = useLocale()
  const [event, setEvent]     = useState(null)
  const [promoter, setPromoter] = useState(null)   // { id, username, handle }
  const [tiers, setTiers]     = useState([])
  const [qty, setQty]         = useState({})       // { tierId: count }
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [purchase, setPurchase] = useState(null) // { tickets, event_slug } when complete

  // ── Source attribution ─────────────────────────────────────────────────
  // Promoters share grail.mx/e/foo?ref=ig — first read of that param wins
  // for the buyer's session, so the eventual purchase carries it through
  // even if the URL gets bookmarked / cleaned up later. Same idea as UTM.
  // Allow `?code=FOO` to deep-link a promo code into the checkout. Caches
  // it for the slug so refresh doesn't drop it.
  const [pendingCode, setPendingCode] = useState('')
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref') || params.get('src') || params.get('utm_source')
    if (ref) {
      try { sessionStorage.setItem(`grail.ref.${slug}`, ref.slice(0, 32)) } catch {}
    }
    const code = params.get('code')
    if (code) {
      try { sessionStorage.setItem(`grail.code.${slug}`, code.slice(0, 40)) } catch {}
      setPendingCode(code.slice(0, 40))
    } else {
      try { setPendingCode(sessionStorage.getItem(`grail.code.${slug}`) || '') } catch {}
    }
  }, [slug])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: ev, error: evErr } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()

      if (cancelled) return

      if (evErr || !ev) {
        setError('not_found')
        setLoading(false)
        return
      }
      setEvent(ev)

      const [{ data: tierRows }, { data: promoterRow }] = await Promise.all([
        supabase
          .from('ticket_tiers')
          .select('*')
          .eq('event_id', ev.id)
          .order('sort_order', { ascending: true }),
        ev.promoter_id
          ? supabase.from('users').select('id, username, handle').eq('id', ev.promoter_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ])

      if (cancelled) return
      setTiers(tierRows || [])
      setPromoter(promoterRow || null)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [slug])

  const totalCents = tiers.reduce((s, ti) => s + (qty[ti.id] || 0) * ti.price_cents, 0)
  const totalTickets = Object.values(qty).reduce((s, n) => s + n, 0)

  const showDate = event?.show_date || event?.event_date
  const showEnded = showDate ? new Date(showDate) < new Date() : false
  const allSoldOut = tiers.length > 0 && tiers.every(ti => (ti.qty - (ti.sold || 0)) <= 0)

  if (loading) {
    return (
      <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '2rem', opacity: 0.4 }}>🕊</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '380px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🕊</div>
          <div style={{ color: C.text, fontSize: '1.3rem', fontWeight: '800', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
            {t('event.notFound.title')}
          </div>
          <div style={{ color: C.textMid, fontSize: '0.88rem', marginBottom: '2rem' }}>
            {t('event.notFound.body')}
          </div>
          <button onClick={() => navigate('/')} style={{
            background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '10px',
            padding: '0.85rem 2rem', fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer', fontFamily: FONT,
          }}>
            {t('event.notFound.cta')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...PAGE, padding: '2rem 1rem 4rem', position: 'relative', overflow: 'hidden' }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '5%', left: '50%', transform: 'translateX(-50%)',
        width: '600px', height: '600px', pointerEvents: 'none',
        background: 'radial-gradient(ellipse, rgba(204,68,238,0.08) 0%, transparent 65%)',
      }} />

      <div style={{ maxWidth: '460px', margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button onClick={() => navigate('/')} style={{
            background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid,
            borderRadius: '8px', padding: '0.4rem 0.85rem', fontSize: '0.82rem',
            cursor: 'pointer', fontFamily: FONT, fontWeight: '600',
          }}>
            {t('common.back')}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <LocaleToggle />
            <div style={LogoMark({ size: 32 })}>GRAIL</div>
          </div>
        </div>

        {/* Flyer + poster */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`,
          borderRadius: '20px', overflow: 'hidden', marginBottom: '1.25rem',
        }}>
          {event.flyer_url ? (
            <img src={event.flyer_url} alt={event.name} style={{ width: '100%', display: 'block', maxHeight: '420px', objectFit: 'cover' }} />
          ) : (
            <div style={{
              height: '180px',
              background: 'linear-gradient(135deg, #2a0a2e 0%, #1a0d2e 40%, #2e0a1a 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '3rem', opacity: 0.5,
            }}>
              🕊
            </div>
          )}

          <div style={{ padding: '1.5rem 1.5rem 1.25rem' }}>
            <div style={{ ...eyebrowStyle(BRAND.pink), marginBottom: '0.5rem' }}>
              {showEnded ? t('event.eyebrow.past') : t('event.eyebrow.live')}
            </div>
            <div style={{ color: C.text, fontWeight: '900', fontSize: '1.5rem', letterSpacing: '-0.02em', marginBottom: '0.4rem', lineHeight: 1.2 }}>
              {event.name || event.artist_name}
            </div>
            <div style={{ color: C.textMid, fontSize: '0.92rem', marginBottom: '0.25rem' }}>
              {fmtDate(showDate, locale)}{event.doors_time && ` · ${locale === 'es' ? 'Puertas' : 'Doors'} ${fmtTime(event.doors_time)}`}
            </div>
            {(event.venue_hint || event.venue_address || event.address) && (
              <div style={{ color: C.textMid, fontSize: '0.85rem' }}>
                {event.venue_hint || event.venue_address || event.address}
              </div>
            )}
            <div style={{ marginTop: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              {event.age_restriction && (
                <span style={badgeStyle('neutral')}>{event.age_restriction}</span>
              )}
              {!showEnded && (
                <button
                  onClick={() => downloadIcs(event, locale)}
                  style={{
                    background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid,
                    borderRadius: '99px', padding: '0.3rem 0.75rem',
                    fontSize: '0.74rem', fontWeight: '700', cursor: 'pointer', fontFamily: FONT,
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>+</span>
                  {t('event.addToCalendar')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {event.description && (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: '14px', padding: '1.25rem 1.4rem', marginBottom: '1.25rem',
            color: C.textMid, fontSize: '0.9rem', lineHeight: 1.6,
          }}>
            {event.description}
          </div>
        )}

        {/* Ticket tiers */}
        {showEnded ? (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: '14px', padding: '2rem', textAlign: 'center',
          }}>
            <div style={{ color: C.text, fontSize: '1.05rem', fontWeight: '800', marginBottom: '0.4rem' }}>
              {t('event.ended.title')}
            </div>
            <div style={{ color: C.textMid, fontSize: '0.85rem' }}>
              {t('event.ended.body')}
            </div>
          </div>
        ) : tiers.length === 0 ? (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: '14px', padding: '2rem', textAlign: 'center',
            color: C.textMid, fontSize: '0.88rem',
          }}>
            {t('event.noTickets')}
          </div>
        ) : (
          <>
            <div style={eyebrowStyle()}>{t('event.tickets')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
              {tiers.map(tier => {
                const remaining = tier.qty - (tier.sold || 0)
                const soldOut = remaining <= 0
                const current = qty[tier.id] || 0
                return (
                  <div key={tier.id} style={{
                    background: C.card, border: `1px solid ${current > 0 ? BRAND.pink + '55' : C.border}`,
                    borderRadius: '12px', padding: '1rem 1.2rem',
                    transition: 'border-color 0.15s',
                    opacity: soldOut ? 0.5 : 1,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: C.text, fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.15rem' }}>{tier.name}</div>
                        {tier.description && (
                          <div style={{ color: C.textMid, fontSize: '0.78rem', marginBottom: '0.25rem' }}>{tier.description}</div>
                        )}
                        <div style={{ color: BRAND.pink, fontWeight: '800', fontSize: '0.95rem' }}>
                          {fmtPriceCents(tier.price_cents, event?.currency)}
                          {!soldOut && remaining < 20 && (
                            <span style={{ color: BRAND.orange, fontWeight: '600', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                              {t('event.fewLeft', { count: remaining })}
                            </span>
                          )}
                        </div>
                      </div>
                      {soldOut ? (
                        <span style={badgeStyle('neutral')}>{t('event.soldOut')}</span>
                      ) : current === 0 ? (
                        <button
                          onClick={() => setQty(q => ({ ...q, [tier.id]: 1 }))}
                          style={{
                            background: BRAND.gradient, color: '#000', border: 'none',
                            borderRadius: '8px', padding: '0.45rem 1rem',
                            fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer', fontFamily: FONT,
                          }}
                        >
                          {t('event.add')}
                        </button>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            onClick={() => setQty(q => {
                              const next = { ...q }
                              if (next[tier.id] > 1) next[tier.id]--
                              else delete next[tier.id]
                              return next
                            })}
                            style={{ background: '#1a1a24', border: 'none', color: C.text, borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, fontFamily: FONT }}
                          >−</button>
                          <span style={{ color: BRAND.neon, fontWeight: '800', fontSize: '0.95rem', minWidth: '18px', textAlign: 'center' }}>{current}</span>
                          <button
                            onClick={() => setQty(q => ({ ...q, [tier.id]: Math.min((q[tier.id] || 0) + 1, remaining) }))}
                            disabled={current >= remaining}
                            style={{ background: '#1a1a24', border: 'none', color: C.text, borderRadius: '6px', width: '28px', height: '28px', cursor: current >= remaining ? 'not-allowed' : 'pointer', fontSize: '1rem', lineHeight: 1, fontFamily: FONT, opacity: current >= remaining ? 0.4 : 1 }}
                          >+</button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {allSoldOut && (
              <WaitlistSignup eventId={event.id} eventName={event.name || event.artist_name} />
            )}

            {/* Sticky checkout footer */}
            {totalTickets > 0 && (
              <div style={{
                position: 'sticky', bottom: '1rem',
                background: C.card, border: `1px solid ${BRAND.pink}44`,
                borderRadius: '14px', padding: '1rem 1.25rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
              }}>
                <div>
                  <div style={{ color: C.textMid, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '700' }}>
                    {t(totalTickets === 1 ? 'event.ticketCount.one' : 'event.ticketCount.many', { count: totalTickets })}
                  </div>
                  <div style={{ color: C.text, fontWeight: '900', fontSize: '1.2rem', letterSpacing: '-0.02em' }}>
                    {fmtPriceCents(totalCents, event?.currency)}
                  </div>
                </div>
                <button
                  onClick={() => setCheckoutOpen(true)}
                  style={{
                    background: BRAND.gradient, color: '#000', border: 'none',
                    borderRadius: '10px', padding: '0.85rem 1.5rem',
                    fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer',
                    fontFamily: FONT,
                  }}
                >
                  {t('event.checkout')}
                </button>
              </div>
            )}
          </>
        )}

        {promoter && !showEnded && (
          <FollowPromoter promoter={promoter} />
        )}

        <div style={{ textAlign: 'center', color: C.textDim, fontSize: '0.72rem', marginTop: '2rem', letterSpacing: '0.05em' }}>
          {t('common.poweredBy')}
        </div>
      </div>

      {checkoutOpen && (
        <CheckoutModal
          event={event}
          tiers={tiers}
          qty={qty}
          totalCents={totalCents}
          initialPromoCode={pendingCode}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={(result) => { setPurchase(result); setCheckoutOpen(false); setQty({}) }}
        />
      )}

      {purchase && (
        <PurchaseConfirmation
          purchase={purchase}
          eventName={event.name || event.artist_name}
          onClose={() => setPurchase(null)}
        />
      )}
    </div>
  )
}

// ─── CHECKOUT MODAL ───────────────────────────────────────────────────────────
function CheckoutModal({ event, tiers, qty, totalCents, initialPromoCode = '', onClose, onSuccess }) {
  const t = useT()
  const { locale } = useLocale()
  const [stage, setStage] = useState('details')   // details | pay
  const [name,  setName]  = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [clientSecret, setClientSecret] = useState(null)
  const [grailOptIn, setGrailOptIn] = useState(false)
  const [grailZip, setGrailZip] = useState('')
  const [grailRadius, setGrailRadius] = useState(25)
  // Promo code is "draft" until validated by the server. We send it through
  // on Continue and let create-payment-intent return the validated price.
  const [promoCode, setPromoCode]   = useState(initialPromoCode || '')
  const [appliedDiscount, setAppliedDiscount] = useState(0)
  const [appliedCode, setAppliedCode]         = useState('')

  const items = tiers
    .filter(ti => qty[ti.id] > 0)
    .map(ti => ({ tier_id: ti.id, qty: qty[ti.id], name: ti.name, price_cents: ti.price_cents }))

  const handleProceed = async (e) => {
    e?.preventDefault()
    setError('')
    if (!name.trim() || !email.trim()) { setError(t('checkout.emailRequired')); return }
    if (!/^\S+@\S+\.\S+$/.test(email))  { setError(t('checkout.emailInvalid'));  return }
    setLoading(true)
    try {
      // Pull the captured ?ref= for this event slug, if any.
      let source = null
      try { source = sessionStorage.getItem(`grail.ref.${event.slug}`) || null } catch {}

      const res = await fetch('/.netlify/functions/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id:    event.id,
          items:       items.map(i => ({ tier_id: i.tier_id, qty: i.qty })),
          buyer_email: email,
          buyer_name:  name,
          lang:        locale,
          promo_code:  promoCode.trim() || null,
          source,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.clientSecret) throw new Error(json.error || t('checkout.startError'))
      if (grailOptIn) {
        // Don't await — opt-in shouldn't block payment if it errors.
        subscribeToLists({
          email, name, zip: grailZip, radiusMiles: grailRadius,
          lang: locale, source: 'checkout',
        })
      }
      setAppliedDiscount(json.discount_cents || 0)
      setAppliedCode(json.promo_applied?.code || '')
      setClientSecret(json.clientSecret)
      setStage('pay')
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '0',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.surface, width: '100%', maxWidth: '480px',
        borderRadius: '22px 22px 0 0', border: `1px solid ${C.border}`, borderBottom: 'none',
        maxHeight: '90vh', overflow: 'auto', padding: '1.5rem 1.5rem 2rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <div style={eyebrowStyle()}>{t('checkout.title')}</div>
            <div style={{ color: C.text, fontSize: '1.1rem', fontWeight: '800', letterSpacing: '-0.01em' }}>
              {event.name || event.artist_name}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textMid, fontSize: '1.6rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Order summary */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
          {items.map(i => (
            <div key={i.tier_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: C.text, marginBottom: '0.3rem' }}>
              <span>{i.qty}× {i.name}</span>
              <span style={{ color: BRAND.pink, fontWeight: '700' }}>{fmtPriceCents(i.qty * i.price_cents, event.currency)}</span>
            </div>
          ))}
          {appliedDiscount > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: C.textMid, marginTop: '0.4rem' }}>
                <span>{t('checkout.subtotal')}</span>
                <span>{fmtPriceCents(totalCents, event.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: BRAND.neon, marginTop: '0.2rem' }}>
                <span>
                  {t('checkout.discount')}
                  {appliedCode && <span style={{ color: C.textMid, marginLeft: '0.4rem', fontFamily: 'ui-monospace, monospace', fontSize: '0.74rem' }}>{appliedCode.toUpperCase()}</span>}
                </span>
                <span>− {fmtPriceCents(appliedDiscount, event.currency)}</span>
              </div>
            </>
          )}
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: '0.5rem', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: C.text, fontWeight: '800' }}>
            <span>{t('checkout.total')}</span>
            <span style={{ color: BRAND.neon }}>{fmtPriceCents(Math.max(0, totalCents - appliedDiscount), event.currency)}</span>
          </div>
        </div>

        {stage === 'details' && (
          <form onSubmit={handleProceed} style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            <input style={INPUT} type="text" placeholder={t('checkout.namePh')} value={name} onChange={e => setName(e.target.value)} required autoComplete="name" />
            <input style={INPUT} type="email" placeholder={t('common.email')} value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            <input
              style={{ ...INPUT, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}
              type="text"
              placeholder={t('checkout.promoPh')}
              value={promoCode}
              onChange={e => setPromoCode(e.target.value)}
              autoComplete="off"
            />
            <GrailOptIn
              checked={grailOptIn} onChange={setGrailOptIn}
              zip={grailZip} setZip={setGrailZip}
              radius={grailRadius} setRadius={setGrailRadius}
            />
            {error && <div style={{ color: BRAND.orange, fontSize: '0.82rem' }}>{error}</div>}
            <button type="submit" disabled={loading} style={{
              background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '10px',
              padding: '0.95rem', fontSize: '0.95rem', fontWeight: '800', cursor: loading ? 'wait' : 'pointer',
              fontFamily: FONT, marginTop: '0.5rem', opacity: loading ? 0.6 : 1,
            }}>
              {loading ? t('checkout.preparing') : t('checkout.continue')}
            </button>
            <div style={{ textAlign: 'center', color: C.textDim, fontSize: '0.7rem', marginTop: '0.25rem' }}>
              {t('checkout.securedBy')}
            </div>
          </form>
        )}

        {stage === 'pay' && clientSecret && stripePromise && (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
            <PaymentStep
              email={email}
              name={name}
              eventId={event.id}
              onBack={() => setStage('details')}
              onSuccess={onSuccess}
            />
          </Elements>
        )}

        {stage === 'pay' && !stripePromise && (
          <div style={{ color: BRAND.orange, fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
            Stripe not configured. Set VITE_STRIPE_PUBLISHABLE_KEY.
          </div>
        )}
      </div>
    </div>
  )
}

function PaymentStep({ onBack, onSuccess }) {
  const t = useT()
  const stripe   = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setErr('')
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    })
    if (error) {
      setErr(error.message)
      setSubmitting(false)
      return
    }
    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
      try {
        const res = await fetch('/.netlify/functions/finalize-ticket-purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_intent_id: paymentIntent.id }),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Could not finalize ticket')
        onSuccess(json)
      } catch (writeErr) {
        setErr(t('checkout.savedFailed', { msg: writeErr.message, pi: paymentIntent.id }))
      }
    } else {
      setErr(t('checkout.unexpectedStatus', { status: paymentIntent?.status || 'unknown' }))
    }
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <PaymentElement options={{ layout: 'tabs', wallets: { link: 'never' } }} />
      {err && <div style={{ color: BRAND.orange, fontSize: '0.85rem' }}>{err}</div>}
      <button type="submit" disabled={!stripe || submitting} style={{
        background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '10px',
        padding: '0.95rem', fontSize: '0.95rem', fontWeight: '800', cursor: submitting ? 'wait' : 'pointer',
        fontFamily: FONT, opacity: submitting ? 0.6 : 1,
      }}>
        {submitting ? t('common.processing') : t('checkout.payNow')}
      </button>
      <button type="button" onClick={onBack} disabled={submitting} style={{
        background: 'transparent', color: C.textMid, border: 'none', cursor: 'pointer',
        fontSize: '0.82rem', padding: '0.25rem', fontFamily: FONT,
      }}>
        {t('common.back')}
      </button>
    </form>
  )
}

// ─── WAITLIST SIGNUP ──────────────────────────────────────────────────────────
// Shown when every tier is sold out. Buyers leave their email and the
// promoter can blast them from the dashboard if a ticket frees up.
function WaitlistSignup({ eventId, eventName }) {
  const t = useT()
  const { locale } = useLocale()
  const [email, setEmail] = useState('')
  const [name,  setName]  = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')
  const [grailOptIn, setGrailOptIn] = useState(false)
  const [grailZip, setGrailZip] = useState('')
  const [grailRadius, setGrailRadius] = useState(25)

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) { setErr(t('waitlist.invalidEmail')); return }
    setSubmitting(true)
    const { error } = await supabase
      .from('event_waitlist')
      .upsert(
        { event_id: eventId, email: email.trim().toLowerCase(), name: name.trim() || null, lang: locale },
        { onConflict: 'event_id,email', ignoreDuplicates: true },
      )
    setSubmitting(false)
    if (error) { setErr(error.message); return }
    if (grailOptIn) subscribeToLists({
      email, name, zip: grailZip, radiusMiles: grailRadius,
      lang: locale, source: 'waitlist',
    })
    setDone(true)
  }

  if (done) {
    return (
      <div style={{
        background: C.card, border: `1px solid ${BRAND.neon}55`,
        borderRadius: '14px', padding: '1.5rem', textAlign: 'center', marginBottom: '1.5rem',
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>🕊</div>
        <div style={{ color: C.text, fontWeight: '800', fontSize: '1rem', marginBottom: '0.35rem' }}>
          {t('waitlist.done.title')}
        </div>
        <div style={{ color: C.textMid, fontSize: '0.85rem', lineHeight: 1.5 }}>
          {t('waitlist.done.body')}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: '14px', padding: '1.25rem 1.4rem', marginBottom: '1.5rem',
    }}>
      <div style={{ ...eyebrowStyle(BRAND.pink), marginBottom: '0.4rem' }}>{t('waitlist.eyebrow')}</div>
      <div style={{ color: C.text, fontWeight: '800', fontSize: '1.05rem', marginBottom: '0.3rem', letterSpacing: '-0.01em' }}>
        {t('waitlist.title')}
      </div>
      <div style={{ color: C.textMid, fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '0.85rem' }}>
        {t('waitlist.body')}
      </div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        <input style={INPUT} type="email" placeholder={t('common.email')} value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        <input style={INPUT} type="text"  placeholder={t('waitlist.namePh')} value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
        <GrailOptIn
          checked={grailOptIn} onChange={setGrailOptIn}
          zip={grailZip} setZip={setGrailZip}
          radius={grailRadius} setRadius={setGrailRadius}
        />
        {err && <div style={{ color: BRAND.orange, fontSize: '0.82rem' }}>{err}</div>}
        <button type="submit" disabled={submitting} style={{
          background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '10px',
          padding: '0.85rem', fontWeight: '800', fontSize: '0.92rem',
          cursor: submitting ? 'wait' : 'pointer', fontFamily: FONT,
          opacity: submitting ? 0.6 : 1, marginTop: '0.25rem',
        }}>
          {submitting ? t('waitlist.adding') : t('waitlist.cta')}
        </button>
      </form>
    </div>
  )
}

// ─── FOLLOW PROMOTER ──────────────────────────────────────────────────────────
// Subscribe to a promoter's future events. Stored on promoter_followers
// with the buyer's zip + radius for future distance-based filtering.
// For v1 the email blast goes to all followers regardless of distance —
// schema captures the geo intent for v2.
function FollowPromoter({ promoter }) {
  const t = useT()
  const { locale } = useLocale()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName]   = useState('')
  const [zip, setZip]     = useState('')
  const [radius, setRadius] = useState(25)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')
  const [grailOptIn, setGrailOptIn] = useState(false)

  const promoterName = promoter?.username || promoter?.handle || 'this promoter'

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) { setErr(t('follow.invalidEmail')); return }
    setSubmitting(true)
    const { error } = await supabase
      .from('promoter_followers')
      .upsert(
        {
          promoter_id:  promoter.id,
          email:        email.trim().toLowerCase(),
          name:         name.trim() || null,
          zip:          zip.trim() || null,
          radius_miles: radius,
          lang:         locale,
        },
        { onConflict: 'promoter_id,email', ignoreDuplicates: true },
      )
    setSubmitting(false)
    if (error) { setErr(error.message); return }
    if (grailOptIn) subscribeToLists({
      email, name, zip, radiusMiles: radius,
      lang: locale, source: 'follow_promoter',
    })
    setDone(true)
  }

  if (done) {
    return (
      <div style={{
        background: C.card, border: `1px solid ${BRAND.neon}55`,
        borderRadius: '14px', padding: '1.25rem 1.4rem', marginTop: '1.5rem', textAlign: 'center',
      }}>
        <div style={{ color: C.text, fontWeight: '800', fontSize: '0.95rem', marginBottom: '0.25rem' }}>
          {t('follow.done.title')}
        </div>
        <div style={{ color: C.textMid, fontSize: '0.82rem', lineHeight: 1.5 }}>
          {t('follow.done.body', { promoter: promoterName })}
        </div>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          marginTop: '1.5rem', width: '100%',
          background: 'transparent', border: `1px solid ${C.border}`,
          color: C.textMid, borderRadius: '12px',
          padding: '0.85rem 1rem', fontSize: '0.85rem', fontWeight: '700',
          cursor: 'pointer', fontFamily: FONT,
        }}
      >
        {t('follow.cta', { promoter: promoterName })} →
      </button>
    )
  }

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: '14px', padding: '1.25rem 1.4rem', marginTop: '1.5rem',
    }}>
      <div style={{ color: C.text, fontWeight: '800', fontSize: '1rem', marginBottom: '0.3rem', letterSpacing: '-0.01em' }}>
        {t('follow.cta', { promoter: promoterName })}
      </div>
      <div style={{ color: C.textMid, fontSize: '0.82rem', lineHeight: 1.5, marginBottom: '0.85rem' }}>
        {t('follow.body')}
      </div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        <input style={INPUT} type="email" placeholder={t('common.email')} value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        <input style={INPUT} type="text"  placeholder={t('waitlist.namePh')} value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
        <input style={INPUT} type="text"  placeholder={t('follow.zipPh')} value={zip} onChange={e => setZip(e.target.value)} inputMode="numeric" autoComplete="postal-code" />
        <div>
          <div style={{ color: C.textMid, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '700', marginBottom: '0.45rem' }}>
            {t('follow.radius')}
          </div>
          <div style={{ display: 'flex', gap: '0.45rem' }}>
            {[10, 25, 50, 100].map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setRadius(r)}
                style={{
                  flex: 1, padding: '0.55rem 0', borderRadius: '8px',
                  border: `1px solid ${radius === r ? BRAND.purple : C.border}`,
                  background: radius === r ? 'rgba(181,123,255,0.1)' : 'transparent',
                  color: radius === r ? BRAND.purple : C.textMid,
                  cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700',
                  fontFamily: FONT,
                }}
              >
                {r}mi
              </button>
            ))}
          </div>
        </div>
        <GrailOptIn checked={grailOptIn} onChange={setGrailOptIn} hideLocation />
        {err && <div style={{ color: BRAND.orange, fontSize: '0.82rem' }}>{err}</div>}
        <button type="submit" disabled={submitting} style={{
          background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '10px',
          padding: '0.85rem', fontWeight: '800', fontSize: '0.92rem',
          cursor: submitting ? 'wait' : 'pointer', fontFamily: FONT,
          opacity: submitting ? 0.6 : 1, marginTop: '0.35rem',
        }}>
          {submitting ? t('follow.subscribing') : t('follow.subscribe')}
        </button>
      </form>
    </div>
  )
}

// ─── PURCHASE CONFIRMATION ────────────────────────────────────────────────────
function PurchaseConfirmation({ purchase, eventName, onClose }) {
  const t = useT()
  const tickets = purchase.tickets || []
  const ticketCount = tickets.length
  const firstTicketUrl = tickets[0] ? `${window.location.origin}/t/${tickets[0].id}` : null

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.surface, border: `1px solid ${BRAND.neon}55`,
        borderRadius: '20px', padding: '2rem', textAlign: 'center',
        maxWidth: '400px', width: '100%',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🕊</div>
        <div style={{ ...eyebrowStyle(BRAND.neon) }}>{t('purchase.eyebrow')}</div>
        <div style={{ color: C.text, fontWeight: '900', fontSize: '1.4rem', letterSpacing: '-0.02em', marginBottom: '0.4rem' }}>
          {t('purchase.youreGoing', { event: eventName })}
        </div>
        <div style={{ color: C.textMid, fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          {t(ticketCount === 1 ? 'purchase.secured.one' : 'purchase.secured.many', { count: ticketCount })}
        </div>

        {tickets.length > 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '0.85rem 1rem', marginBottom: '1.25rem', textAlign: 'left' }}>
            <div style={{ ...eyebrowStyle(C.textMid), fontSize: '0.62rem', marginBottom: '0.5rem' }}>
              {t(tickets.length > 1 ? 'purchase.yourTicket.many' : 'purchase.yourTicket.one')}
            </div>
            {tickets.map((tk, i) => (
              <a
                key={tk.id}
                href={`${window.location.origin}/t/${tk.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.5rem 0',
                  borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                  color: BRAND.pink, textDecoration: 'none', fontSize: '0.88rem', fontWeight: '700',
                }}
              >
                <span>{t('purchase.viewTicket', { n: tk.ticket_number })}</span>
                <span style={{ color: C.textMid, fontSize: '0.85rem' }}>{t('purchase.view')}</span>
              </a>
            ))}
          </div>
        )}

        {firstTicketUrl && (
          <a
            href={firstTicketUrl}
            style={{
              display: 'block',
              background: BRAND.gradient, color: '#000', borderRadius: '10px',
              padding: '0.85rem', fontSize: '0.92rem', fontWeight: '800',
              textDecoration: 'none', marginBottom: '0.5rem', fontFamily: FONT,
            }}
          >
            {t('purchase.openTicket')}
          </a>
        )}
        <button onClick={onClose} style={{
          background: 'transparent', color: C.textMid, border: 'none',
          padding: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', fontFamily: FONT,
        }}>
          {t('common.close')}
        </button>
      </div>
    </div>
  )
}
