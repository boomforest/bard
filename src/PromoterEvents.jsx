import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { BRAND, C, FONT, PAGE, eyebrowStyle, badgeStyle } from './theme'

const fmtDate = (iso) => {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function PromoterEvents({ promoterId, onNew, onCheckStripe, stripeReady }) {
  const navigate = useNavigate()
  const [events,  setEvents]  = useState([])
  const [loading, setLoading] = useState(true)
  const [copied,  setCopied]  = useState('')

  useEffect(() => {
    if (!promoterId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('events')
        .select('id, name, artist_name, slug, show_date, event_date, capacity, tickets_sold, status, flyer_url')
        .eq('promoter_id', promoterId)
        .order('created_at', { ascending: false })
      if (!cancelled) {
        setEvents(data || [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [promoterId])

  const copy = (text, key) => {
    navigator.clipboard?.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 1500)
  }

  return (
    <div style={{ ...PAGE, padding: '2rem 1.5rem 4rem' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <div style={eyebrowStyle()}>Promoter</div>
            <div style={{ color: C.text, fontSize: '1.6rem', fontWeight: '900', letterSpacing: '-0.02em' }}>Your Events</div>
          </div>
          <button onClick={onNew} style={{
            background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '10px',
            padding: '0.7rem 1.2rem', fontSize: '0.88rem', fontWeight: '800',
            cursor: 'pointer', fontFamily: FONT,
          }}>
            + New Event
          </button>
        </div>

        {/* Stripe status banner */}
        {stripeReady === false && (
          <div style={{
            background: 'rgba(240,112,32,0.08)',
            border: `1px solid ${BRAND.orange}55`,
            borderRadius: '12px', padding: '1rem 1.25rem', marginBottom: '1.5rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
          }}>
            <div>
              <div style={{ color: C.text, fontWeight: '700', fontSize: '0.92rem', marginBottom: '0.2rem' }}>
                Connect Stripe to start selling tickets.
              </div>
              <div style={{ color: C.textMid, fontSize: '0.8rem' }}>
                Until your account is connected, the Checkout button on your event pages stays disabled.
              </div>
            </div>
            <button onClick={onCheckStripe} style={{
              background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '8px',
              padding: '0.55rem 1rem', fontSize: '0.82rem', fontWeight: '800', cursor: 'pointer',
              fontFamily: FONT, flexShrink: 0, whiteSpace: 'nowrap',
            }}>
              Connect →
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', fontSize: '2rem', opacity: 0.4 }}>🕊</div>
        ) : events.length === 0 ? (
          <div style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: '14px', padding: '3rem 2rem', textAlign: 'center',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.5 }}>🕊</div>
            <div style={{ color: C.text, fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.4rem' }}>
              No events yet.
            </div>
            <div style={{ color: C.textMid, fontSize: '0.88rem', marginBottom: '1.5rem' }}>
              Build your first show to start selling tickets.
            </div>
            <button onClick={onNew} style={{
              background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '10px',
              padding: '0.85rem 1.75rem', fontSize: '0.95rem', fontWeight: '800',
              cursor: 'pointer', fontFamily: FONT,
            }}>
              + New Event
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {events.map(ev => {
              const date = ev.show_date || ev.event_date
              const isPast = date && new Date(date) < new Date()
              const eventLink = `${window.location.origin}/e/${ev.slug}`
              const scanLink  = `${window.location.origin}/scan/${ev.slug}`
              const sold = ev.tickets_sold || 0
              const cap = ev.capacity || 0
              return (
                <div key={ev.id} style={{
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: '14px', overflow: 'hidden',
                }}>
                  <button
                    onClick={() => navigate(`/promoter/event/${ev.slug}`)}
                    style={{
                      display: 'flex', gap: '1rem', padding: '1rem 1.25rem', width: '100%',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      textAlign: 'left', fontFamily: FONT,
                    }}
                  >
                    {ev.flyer_url ? (
                      <img src={ev.flyer_url} alt={ev.name} style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: '64px', height: '64px', borderRadius: '8px', background: 'linear-gradient(135deg, #2a0a2e, #1a0d2e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0, opacity: 0.6 }}>🕊</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <div style={{ color: C.text, fontWeight: '800', fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ev.name || ev.artist_name}
                        </div>
                        <span style={badgeStyle(isPast ? 'neutral' : 'live')}>{isPast ? 'Past' : 'Live'}</span>
                      </div>
                      <div style={{ color: C.textMid, fontSize: '0.82rem' }}>
                        {fmtDate(date)} · {sold}/{cap} tickets sold
                      </div>
                    </div>
                    <div style={{ alignSelf: 'center', color: C.textMid, fontSize: '1.1rem', flexShrink: 0 }}>›</div>
                  </button>

                  <div style={{ display: 'flex', borderTop: `1px solid ${C.border}` }}>
                    <a
                      href={eventLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flex: 1, textAlign: 'center', padding: '0.75rem',
                        color: C.textMid, fontSize: '0.8rem', textDecoration: 'none',
                        borderRight: `1px solid ${C.border}`, fontFamily: FONT, fontWeight: '600',
                      }}
                    >
                      View
                    </a>
                    <button
                      onClick={() => copy(eventLink, `ev-${ev.id}`)}
                      style={{
                        flex: 1, padding: '0.75rem', background: 'transparent', border: 'none',
                        color: copied === `ev-${ev.id}` ? BRAND.neon : C.textMid,
                        fontSize: '0.8rem', cursor: 'pointer',
                        borderRight: `1px solid ${C.border}`, fontFamily: FONT, fontWeight: '600',
                      }}
                    >
                      {copied === `ev-${ev.id}` ? '✓ Copied' : 'Copy ticket link'}
                    </button>
                    <button
                      onClick={() => copy(scanLink, `sc-${ev.id}`)}
                      style={{
                        flex: 1, padding: '0.75rem', background: 'transparent', border: 'none',
                        color: copied === `sc-${ev.id}` ? BRAND.neon : C.textMid,
                        fontSize: '0.8rem', cursor: 'pointer', fontFamily: FONT, fontWeight: '600',
                      }}
                    >
                      {copied === `sc-${ev.id}` ? '✓ Copied' : 'Copy scanner link'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
