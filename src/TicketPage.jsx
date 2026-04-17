import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { BRAND, C, FONT, PAGE, eyebrowStyle, LogoMark, badgeStyle } from './theme'

export default function TicketPage() {
  const [eventData, setEventData] = useState(null)
  const [showFlier, setShowFlier] = useState(false)

  useEffect(() => {
    fetchEvent()
  }, [])

  const fetchEvent = async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('artist_name', 'Nonlinear')
      .single()
    if (data) setEventData(data)
  }

  const ticketsSold = eventData?.tickets_sold || 0
  const capacity    = eventData?.capacity || 250

  return (
    <div style={{
      ...PAGE,
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '2.5rem 1rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
        width: '600px', height: '600px', pointerEvents: 'none',
        background: 'radial-gradient(ellipse, rgba(204,68,238,0.08) 0%, transparent 65%)',
      }} />

      <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <div style={LogoMark({ size: 44 })}>GRAIL</div>
        </div>

        {/* Poster card */}
        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: '20px 20px 0 0',
          borderBottom: 'none',
          padding: '2.5rem 2rem 2rem',
          textAlign: 'center',
        }}>
          <div style={{ ...eyebrowStyle(BRAND.pink), marginBottom: '0.75rem' }}>
            Secret Show · April 2026
          </div>

          <img
            src="https://elkfhmyhiyyubtqzqlpq.supabase.co/storage/v1/object/public/ticket-images/nonlinear%20outline.svg"
            alt="Nonlinear"
            style={{
              width: '100%', display: 'block', margin: '0 auto 0.5rem',
              filter: 'brightness(0) invert(1)',
              opacity: 0.85,
            }}
          />

          <div style={{
            width: '60px', height: '2px',
            background: BRAND.gradient,
            margin: '1rem auto',
          }} />

          <div style={{ color: C.text, fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.35rem', letterSpacing: '-0.01em' }}>
            Saturday, April 11 · 11PM
          </div>
          <div style={{ color: C.textMid, fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            Secret location · Condesa / Roma, CDMX
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
            <span style={badgeStyle('neutral')}>Show Ended</span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.25rem' }}>
            <button
              onClick={() => setShowFlier(true)}
              style={{
                background: 'transparent',
                border: `1px solid ${C.border}`,
                borderRadius: '99px',
                padding: '0.4rem 1rem',
                color: C.textMid,
                fontSize: '0.72rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                fontFamily: FONT,
                fontWeight: '600',
              }}
            >
              View Flier
            </button>
            <a
              href="/nonlinear.html"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'transparent',
                border: `1px solid ${C.border}`,
                borderRadius: '99px',
                padding: '0.4rem 1rem',
                color: C.textMid,
                fontSize: '0.72rem',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                textDecoration: 'none',
                fontFamily: FONT,
                fontWeight: '600',
              }}
            >
              Event Info
            </a>
          </div>
        </div>

        {/* Flier modal */}
        {showFlier && (
          <div
            onClick={() => setShowFlier(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,0.9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '1rem',
            }}
          >
            <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '480px', width: '100%' }}>
              <img
                src="/flyer.jpg"
                alt="Event flier"
                style={{ width: '100%', borderRadius: '12px', display: 'block' }}
              />
              <button
                onClick={() => setShowFlier(false)}
                style={{
                  position: 'absolute', top: '0.5rem', right: '0.5rem',
                  background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%',
                  width: '2rem', height: '2rem', color: '#fff',
                  fontSize: '1rem', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Past-event body */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderTop: 'none',
          borderRadius: '0 0 20px 20px',
          padding: '2rem',
          textAlign: 'center',
        }}>
          <div style={{ color: C.text, fontWeight: '800', fontSize: '1.3rem', marginBottom: '0.6rem', letterSpacing: '-0.02em' }}>
            Thank you for coming.
          </div>
          <div style={{ color: C.textMid, fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
            This show has ended. {ticketsSold > 0 && `${ticketsSold} of ${capacity} tickets were sold.`}
            <br />
            Follow Nonlinear to catch the next one.
          </div>

          <a
            href="/"
            style={{
              display: 'inline-block',
              background: BRAND.gradient,
              color: '#000',
              border: 'none',
              borderRadius: '12px',
              padding: '0.95rem 2rem',
              fontSize: '0.95rem',
              fontWeight: '800',
              cursor: 'pointer',
              textDecoration: 'none',
              fontFamily: FONT,
            }}
          >
            Explore GRAIL →
          </a>

          <div style={{ marginTop: '1.5rem', color: C.textDim, fontSize: '0.72rem' }}>
            Ticket sales are currently disabled. Reach out at jp@casadecopas.com.
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', color: C.textDim, fontSize: '0.72rem', marginTop: '1.5rem', letterSpacing: '0.05em' }}>
          Powered by GRAIL
        </div>
      </div>
    </div>
  )
}
