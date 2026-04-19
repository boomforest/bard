import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabase'
import { QRCode } from 'react-qrcode-logo'
import { BRAND, C, FONT, PAGE, eyebrowStyle, LogoMark, badgeStyle } from './theme'

const fmtDate = (iso) => {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'America/Mexico_City',
  })
}

const fmtTime = (timeStr, iso) => {
  if (timeStr) {
    const [h, m] = timeStr.split(':')
    const hour = parseInt(h, 10)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const h12  = hour % 12 || 12
    return `${h12}:${m} ${ampm}`
  }
  if (iso) {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: 'America/Mexico_City',
    })
  }
  return ''
}

export default function TicketView() {
  const { ticketId } = useParams()
  const [ticket, setTicket] = useState(null)
  const [event, setEvent]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!ticketId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error: err } = await supabase
        .from('tickets')
        .select('*, events(*)')
        .eq('id', ticketId)
        .maybeSingle()
      if (cancelled) return
      if (err || !data) {
        setError('Ticket not found.')
        setLoading(false)
        return
      }
      setTicket(data)
      setEvent(data.events)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [ticketId])

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
          <div style={{ color: C.text, fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.5rem' }}>{error}</div>
          <div style={{ color: C.textMid, fontSize: '0.85rem' }}>Check your link and try again.</div>
        </div>
      </div>
    )
  }

  const eventName = event?.name || event?.artist_name || 'Event'
  const dateStr   = fmtDate(event?.show_date || event?.event_date)
  const timeStr   = fmtTime(event?.doors_time, event?.show_date || event?.event_date)
  const venue     = event?.venue_hint || event?.venue_address || event?.address || ''

  return (
    <div style={{
      ...PAGE,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: '500px', height: '500px', pointerEvents: 'none',
        background: 'radial-gradient(ellipse, rgba(204,68,238,0.08) 0%, transparent 65%)',
      }} />

      <div style={{ marginBottom: '1.25rem', position: 'relative', zIndex: 1 }}>
        <div style={LogoMark({ size: 56 })}>GRAIL</div>
      </div>

      <div style={{
        width: '100%', maxWidth: '360px', position: 'relative', zIndex: 1,
        background: C.card, border: `1px solid ${C.border}`,
        borderRadius: '20px', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>
        {/* Flyer header */}
        <div style={{ position: 'relative', height: '160px', overflow: 'hidden' }}>
          {event?.flyer_url ? (
            <img src={event.flyer_url} alt={eventName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #2a0a2e 0%, #1a0d2e 40%, #2e0a1a 100%)' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(18,18,26,0.95) 100%)' }} />
          <div style={{ position: 'absolute', bottom: '0.85rem', left: '1.2rem', right: '1.2rem' }}>
            <div style={{ ...eyebrowStyle(BRAND.pink), fontSize: '0.62rem', marginBottom: '0.3rem' }}>
              {ticket?.torn ? 'Already Admitted' : 'Active Ticket'}
            </div>
            <div style={{ color: C.text, fontWeight: '900', fontSize: '1.3rem', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
              {eventName}
            </div>
            <div style={{ color: C.textMid, fontSize: '0.78rem', marginTop: '0.25rem' }}>
              {dateStr}{timeStr && ` · ${timeStr}`}
            </div>
          </div>
        </div>

        {/* Venue */}
        {venue && (
          <div style={{ padding: '1rem 1.2rem 0' }}>
            <div style={{ ...eyebrowStyle(C.textMid), fontSize: '0.62rem', marginBottom: '0.2rem' }}>Venue</div>
            <div style={{ color: C.text, fontWeight: '700', fontSize: '0.92rem' }}>{venue}</div>
          </div>
        )}

        {/* Perforated divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '1.2rem 0', padding: '0 1.2rem', gap: '0.3rem' }}>
          <div style={{ flex: 1, borderTop: `1.5px dashed ${C.border}` }} />
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: C.bg, border: `1px solid ${C.border}`, flexShrink: 0 }} />
          <div style={{ flex: 1, borderTop: `1.5px dashed ${C.border}` }} />
        </div>

        {/* QR + holder info */}
        <div style={{ padding: '0 1.2rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ flexShrink: 0, opacity: ticket?.torn ? 0.35 : 1 }}>
            <QRCode
              value={ticket?.id || ''}
              size={120}
              bgColor="#0a0a14"
              fgColor={ticket?.torn ? C.textMid : BRAND.pink}
              qrStyle="squares"
              eyeRadius={6}
              level="L"
              style={{ display: 'block' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...eyebrowStyle(C.textMid), fontSize: '0.62rem', marginBottom: '0.3rem' }}>Ticket holder</div>
            <div style={{ color: C.text, fontWeight: '700', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {ticket?.name || 'Guest'}
            </div>
            <div style={{ color: BRAND.pink, fontWeight: '800', fontSize: '0.85rem', marginTop: '0.3rem' }}>
              #{ticket?.ticket_number}
            </div>
            {ticket?.tier_name && (
              <div style={{ marginTop: '0.5rem' }}>
                <span style={badgeStyle('live')}>{ticket.tier_name}</span>
              </div>
            )}
            {ticket?.torn && (
              <div style={{ marginTop: '0.5rem' }}>
                <span style={badgeStyle('neutral')}>USED</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ color: C.textMid, fontSize: '0.78rem', marginTop: '1rem', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        {ticket?.torn ? 'This ticket has already been used.' : 'Show this screen at the door.'}
      </div>

      {/* Bar entry — only show when the event has bar enabled and a slug */}
      {event?.bar_enabled !== false && event?.slug && (
        <a
          href={`/${event.slug}/bar`}
          style={{
            display: 'block', marginTop: '1.25rem', width: '100%', maxWidth: '360px',
            background: BRAND.gradient, color: '#000', textAlign: 'center',
            borderRadius: '14px', padding: '0.95rem',
            fontSize: '0.95rem', fontWeight: '800', textDecoration: 'none',
            position: 'relative', zIndex: 1, fontFamily: FONT,
          }}
        >
          🥂 Order from the bar →
        </a>
      )}

      {ticket?.torn && ticket?.torn_at && (
        <div style={{ color: C.textDim, fontSize: '0.72rem', marginTop: '0.4rem', position: 'relative', zIndex: 1 }}>
          Admitted {new Date(ticket.torn_at).toLocaleString('en-US', { timeZone: 'America/Mexico_City', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </div>
      )}
    </div>
  )
}
