import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { BRAND, C, FONT, PAGE, eyebrowStyle, LogoMark, badgeStyle } from './theme'

const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

const fmtTime = (timeStr) => {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h12  = hour % 12 || 12
  return `${h12}:${m} ${ampm}`
}

const dollars = (cents) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export default function EventPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [event, setEvent]     = useState(null)
  const [tiers, setTiers]     = useState([])
  const [qty, setQty]         = useState({})       // { tierId: count }
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

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
        setError('Event not found.')
        setLoading(false)
        return
      }
      setEvent(ev)

      const { data: tierRows } = await supabase
        .from('ticket_tiers')
        .select('*')
        .eq('event_id', ev.id)
        .order('sort_order', { ascending: true })

      if (cancelled) return
      setTiers(tierRows || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [slug])

  const totalCents = tiers.reduce((s, t) => s + (qty[t.id] || 0) * t.price_cents, 0)
  const totalTickets = Object.values(qty).reduce((s, n) => s + n, 0)

  const showDate = event?.show_date || event?.event_date
  const showEnded = showDate ? new Date(showDate) < new Date() : false

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
            Event not found
          </div>
          <div style={{ color: C.textMid, fontSize: '0.88rem', marginBottom: '2rem' }}>
            The link may be wrong, or this event isn't live yet.
          </div>
          <button onClick={() => navigate('/')} style={{
            background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '10px',
            padding: '0.85rem 2rem', fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer', fontFamily: FONT,
          }}>
            Explore GRAIL →
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
            ← Back
          </button>
          <div style={LogoMark({ size: 32 })}>GRAIL</div>
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
              {showEnded ? 'Past Event' : 'Live Now'}
            </div>
            <div style={{ color: C.text, fontWeight: '900', fontSize: '1.5rem', letterSpacing: '-0.02em', marginBottom: '0.4rem', lineHeight: 1.2 }}>
              {event.name || event.artist_name}
            </div>
            <div style={{ color: C.textMid, fontSize: '0.92rem', marginBottom: '0.25rem' }}>
              {fmtDate(showDate)}{event.doors_time && ` · Doors ${fmtTime(event.doors_time)}`}
            </div>
            {(event.venue_hint || event.venue_address || event.address) && (
              <div style={{ color: C.textMid, fontSize: '0.85rem' }}>
                {event.venue_hint || event.venue_address || event.address}
              </div>
            )}
            {event.age_restriction && (
              <div style={{ marginTop: '0.75rem' }}>
                <span style={badgeStyle('neutral')}>{event.age_restriction}</span>
              </div>
            )}
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
              This show has ended.
            </div>
            <div style={{ color: C.textMid, fontSize: '0.85rem' }}>
              Thanks for being part of it.
            </div>
          </div>
        ) : tiers.length === 0 ? (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: '14px', padding: '2rem', textAlign: 'center',
            color: C.textMid, fontSize: '0.88rem',
          }}>
            No tickets available yet.
          </div>
        ) : (
          <>
            <div style={eyebrowStyle()}>Tickets</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
              {tiers.map(t => {
                const remaining = t.qty - (t.sold || 0)
                const soldOut = remaining <= 0
                const current = qty[t.id] || 0
                return (
                  <div key={t.id} style={{
                    background: C.card, border: `1px solid ${current > 0 ? BRAND.pink + '55' : C.border}`,
                    borderRadius: '12px', padding: '1rem 1.2rem',
                    transition: 'border-color 0.15s',
                    opacity: soldOut ? 0.5 : 1,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ color: C.text, fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.15rem' }}>{t.name}</div>
                        {t.description && (
                          <div style={{ color: C.textMid, fontSize: '0.78rem', marginBottom: '0.25rem' }}>{t.description}</div>
                        )}
                        <div style={{ color: BRAND.pink, fontWeight: '800', fontSize: '0.95rem' }}>
                          {dollars(t.price_cents)}
                          {!soldOut && remaining < 20 && (
                            <span style={{ color: BRAND.orange, fontWeight: '600', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                              · {remaining} left
                            </span>
                          )}
                        </div>
                      </div>
                      {soldOut ? (
                        <span style={badgeStyle('neutral')}>Sold Out</span>
                      ) : current === 0 ? (
                        <button
                          onClick={() => setQty(q => ({ ...q, [t.id]: 1 }))}
                          style={{
                            background: BRAND.gradient, color: '#000', border: 'none',
                            borderRadius: '8px', padding: '0.45rem 1rem',
                            fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer', fontFamily: FONT,
                          }}
                        >
                          Add
                        </button>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button
                            onClick={() => setQty(q => {
                              const next = { ...q }
                              if (next[t.id] > 1) next[t.id]--
                              else delete next[t.id]
                              return next
                            })}
                            style={{ background: '#1a1a24', border: 'none', color: C.text, borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, fontFamily: FONT }}
                          >−</button>
                          <span style={{ color: BRAND.neon, fontWeight: '800', fontSize: '0.95rem', minWidth: '18px', textAlign: 'center' }}>{current}</span>
                          <button
                            onClick={() => setQty(q => ({ ...q, [t.id]: Math.min((q[t.id] || 0) + 1, remaining) }))}
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
                    {totalTickets} ticket{totalTickets !== 1 ? 's' : ''}
                  </div>
                  <div style={{ color: C.text, fontWeight: '900', fontSize: '1.2rem', letterSpacing: '-0.02em' }}>
                    {dollars(totalCents)}
                  </div>
                </div>
                <button
                  disabled
                  title="Checkout coming next"
                  style={{
                    background: '#2a2a3a', color: C.textMid, border: 'none',
                    borderRadius: '10px', padding: '0.85rem 1.5rem',
                    fontWeight: '800', fontSize: '0.95rem', cursor: 'not-allowed',
                    fontFamily: FONT,
                  }}
                >
                  Checkout — coming soon
                </button>
              </div>
            )}
          </>
        )}

        <div style={{ textAlign: 'center', color: C.textDim, fontSize: '0.72rem', marginTop: '2rem', letterSpacing: '0.05em' }}>
          Powered by GRAIL
        </div>
      </div>
    </div>
  )
}
