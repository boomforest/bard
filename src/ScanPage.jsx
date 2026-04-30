import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import jsQR from 'jsqr'
import { supabase } from './supabase'
import { BRAND, C, FONT, PAGE, eyebrowStyle, LogoMark, badgeStyle } from './theme'

// UUID v4 sanity check (loose) — used to detect when the QR encodes a ticket id
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function ScanPage() {
  const { slug } = useParams()
  const navigate = useNavigate()

  const [event, setEvent]         = useState(null)
  const [eventErr, setEventErr]   = useState('')
  const [scanning, setScanning]   = useState(false)
  const [result, setResult]       = useState(null)
  const [admitting, setAdmitting] = useState(false)
  const [manualInput, setManualInput] = useState('')

  const videoRef    = useRef(null)
  const canvasRef   = useRef(null)
  const streamRef   = useRef(null)
  const rafRef      = useRef(null)
  const handledRef  = useRef(false)
  const eventIdRef  = useRef(null)

  // ─── Load event by slug (or promoter handle, redirected) ────────────────
  useEffect(() => {
    if (!slug) { setEventErr('No event specified.'); return }
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from('events')
        .select('id, slug, name, artist_name, capacity, tickets_sold')
        .eq('slug', slug)
        .maybeSingle()
      if (cancelled) return
      if (data) {
        setEvent(data)
        eventIdRef.current = data.id
        return
      }
      // Fallback: try as promoter handle → redirect to latest event's scan
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('handle', slug)
        .maybeSingle()
      if (cancelled) return
      if (user) {
        const { data: rows } = await supabase
          .from('events')
          .select('slug, event_date, show_date')
          .eq('promoter_id', user.id)
          .order('event_date', { ascending: false })
          .limit(20)
        if (cancelled) return
        const list = rows || []
        const now = Date.now()
        const dateOf = (e) => new Date(e.event_date || e.show_date || 0).getTime()
        const upcoming = list.filter(e => dateOf(e) >= now).sort((a, b) => dateOf(a) - dateOf(b))
        const target = upcoming[0] || list[0]
        if (target?.slug) { navigate(`/${target.slug}/scan`, { replace: true }); return }
      }
      setEventErr('Event not found.')
    }
    load()
    return () => { cancelled = true }
  }, [slug, navigate])

  // ─── Camera + scan loop ─────────────────────────────────────────────────
  const startScanner = async () => {
    setResult(null)
    handledRef.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setScanning(true)
      tick()
    } catch {
      setResult({ status: 'error', message: 'Camera access denied. Check browser permissions.' })
    }
  }

  const tick = () => {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    if (video.readyState < 2) {
      rafRef.current = requestAnimationFrame(tick)
      return
    }
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    })
    if (code && !handledRef.current) {
      handledRef.current = true
      stopScanner()
      handleScan(code.data)
    } else {
      rafRef.current = requestAnimationFrame(tick)
    }
  }

  const stopScanner = () => {
    cancelAnimationFrame(rafRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setScanning(false)
  }

  // ─── Lookup logic ──────────────────────────────────────────────────────
  const handleScan = async (raw) => {
    if (!eventIdRef.current) {
      setResult({ status: 'error', message: 'Event not loaded yet.' })
      return
    }
    const text = (raw || '').trim()
    if (!text) {
      setResult({ status: 'error', message: 'Empty scan.' })
      return
    }

    let q = supabase
      .from('tickets')
      .select('id, ticket_number, name, email, torn, torn_at, tier_name, event_id, refunded')
      .eq('event_id', eventIdRef.current)

    if (UUID_RE.test(text)) {
      q = q.eq('id', text)
    } else {
      const num = parseInt(text, 10)
      if (isNaN(num)) {
        setResult({ status: 'error', message: `Unrecognized QR: "${text.slice(0, 40)}"` })
        return
      }
      q = q.eq('ticket_number', num)
    }

    const { data, error } = await q.maybeSingle()

    if (error) {
      setResult({ status: 'error', message: error.message })
      return
    }
    if (!data) {
      setResult({ status: 'not_found', token: text })
      return
    }
    if (data.refunded) {
      setResult({ status: 'refunded', ticket: data })
      return
    }
    setResult({ status: data.torn ? 'already_torn' : 'valid', ticket: data })
  }

  const handleAdmit = async () => {
    if (!result?.ticket) return
    setAdmitting(true)
    const { error } = await supabase
      .from('tickets')
      .update({ torn: true, torn_at: new Date().toISOString() })
      .eq('id', result.ticket.id)
    if (!error) {
      setResult(prev => ({ ...prev, status: 'admitted' }))
      setTimeout(() => setResult(null), 2500)
    }
    setAdmitting(false)
  }

  useEffect(() => () => stopScanner(), [])

  // ─── Error / loading guards ────────────────────────────────────────────
  if (eventErr) {
    return (
      <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: '380px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🕊</div>
          <div style={{ color: C.text, fontSize: '1.2rem', fontWeight: '800', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
            {eventErr}
          </div>
          <div style={{ color: C.textMid, fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Door scanner needs an event slug. Try /scan/your-event
          </div>
          <button onClick={() => navigate('/')} style={{
            background: BRAND.gradient, color: '#000', border: 'none', borderRadius: '10px',
            padding: '0.85rem 1.5rem', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', fontFamily: FONT,
          }}>
            Home →
          </button>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div style={{ ...PAGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '2rem', opacity: 0.4 }}>🕊</div>
      </div>
    )
  }

  const eventName = event.name || event.artist_name
  const admittedSoFar = result?.status === 'admitted' ? 1 : 0  // hint only

  return (
    <div style={{ ...PAGE, padding: '2rem 1rem 3rem' }}>
      <div style={{ width: '100%', maxWidth: '420px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <button onClick={() => navigate('/promoter')} style={{
            background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid,
            borderRadius: '8px', padding: '0.4rem 0.85rem', fontSize: '0.8rem',
            cursor: 'pointer', fontFamily: FONT, fontWeight: '600',
          }}>
            ← Back
          </button>
          <div style={LogoMark({ size: 32 })}>GRAIL</div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={eyebrowStyle()}>Door Scanner</div>
          <div style={{ color: C.text, fontSize: '1.4rem', fontWeight: '900', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {eventName}
          </div>
          <div style={{ color: C.textMid, fontSize: '0.8rem', marginTop: '0.25rem' }}>
            {event.tickets_sold || 0} tickets sold · capacity {event.capacity}
          </div>
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            display: scanning ? 'block' : 'none',
            width: '100%',
            borderRadius: '16px',
            marginBottom: '1rem',
            background: C.card,
            border: `1px solid ${C.border}`,
          }}
        />

        {/* Result card */}
        {result && (
          <div style={{
            borderRadius: '16px',
            padding: '1.75rem 1.5rem',
            marginBottom: '1.25rem',
            textAlign: 'center',
            background:
              result.status === 'valid'         ? 'rgba(34,197,94,0.08)' :
              result.status === 'admitted'      ? 'rgba(170,255,0,0.10)' :
              result.status === 'already_torn'  ? 'rgba(239,68,68,0.10)' :
                                                  'rgba(240,112,32,0.08)',
            border: `1.5px solid ${
              result.status === 'valid' || result.status === 'admitted'
                ? BRAND.neon
                : result.status === 'already_torn'
                  ? C.red
                  : BRAND.orange
            }`,
          }}>
            {result.status === 'valid' && (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '0.25rem' }}>✓</div>
                <div style={{ ...eyebrowStyle(BRAND.neon) }}>Valid Ticket</div>
                <div style={{ fontSize: '2.2rem', fontWeight: '900', color: C.text, marginBottom: '0.25rem', letterSpacing: '-0.02em', lineHeight: 1 }}>
                  #{result.ticket.ticket_number}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: '700', color: C.text, marginBottom: '0.4rem' }}>{result.ticket.name || 'Guest'}</div>
                {result.ticket.tier_name && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <span style={badgeStyle('live')}>{result.ticket.tier_name}</span>
                  </div>
                )}
                <button
                  onClick={handleAdmit}
                  disabled={admitting}
                  style={{
                    width: '100%', padding: '1rem',
                    background: admitting ? '#1a1a24' : BRAND.gradient,
                    color: admitting ? C.textMid : '#000',
                    border: 'none', borderRadius: '12px',
                    fontSize: '1.05rem', fontWeight: '900',
                    cursor: admitting ? 'not-allowed' : 'pointer', fontFamily: FONT,
                    letterSpacing: '0.02em',
                  }}
                >
                  {admitting ? 'Admitting…' : 'ADMIT'}
                </button>
              </>
            )}
            {result.status === 'admitted' && (
              <>
                <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>🎉</div>
                <div style={{ color: BRAND.neon, fontSize: '1.2rem', fontWeight: '900', letterSpacing: '0.05em' }}>ADMITTED</div>
                <div style={{ color: C.textMid, fontSize: '0.9rem', marginTop: '0.4rem' }}>{result.ticket?.name}</div>
              </>
            )}
            {result.status === 'already_torn' && (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '0.25rem' }}>⛔</div>
                <div style={{ color: C.red, fontSize: '1rem', fontWeight: '900', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>ALREADY ADMITTED</div>
                <div style={{ color: C.text, fontSize: '1.05rem', fontWeight: '700' }}>
                  #{result.ticket.ticket_number} — {result.ticket.name}
                </div>
                {result.ticket.torn_at && (
                  <div style={{ color: C.textMid, fontSize: '0.78rem', marginTop: '0.4rem' }}>
                    at {new Date(result.ticket.torn_at).toLocaleString('en-US', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </>
            )}
            {result.status === 'refunded' && (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '0.25rem' }}>↩</div>
                <div style={{ color: C.red, fontSize: '1rem', fontWeight: '900', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>REFUNDED — DO NOT ADMIT</div>
                <div style={{ color: C.text, fontSize: '1.05rem', fontWeight: '700' }}>
                  #{result.ticket.ticket_number} — {result.ticket.name}
                </div>
                <div style={{ color: C.textMid, fontSize: '0.78rem', marginTop: '0.4rem' }}>
                  This ticket has been refunded by the promoter.
                </div>
              </>
            )}
            {result.status === 'not_found' && (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '0.25rem' }}>❓</div>
                <div style={{ color: BRAND.orange, fontSize: '1rem', fontWeight: '900', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>NOT FOUND IN THIS EVENT</div>
                <div style={{ color: C.textMid, fontSize: '0.85rem' }}>
                  Token "{(result.token || '').slice(0, 24)}{(result.token || '').length > 24 ? '…' : ''}" doesn't match a ticket for {eventName}.
                </div>
              </>
            )}
            {result.status === 'error' && (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '0.25rem' }}>⚠️</div>
                <div style={{ color: BRAND.orange, fontSize: '0.9rem', marginTop: '0.5rem' }}>{result.message}</div>
              </>
            )}
          </div>
        )}

        {!scanning && (
          <button
            onClick={startScanner}
            style={{
              width: '100%', padding: '1.05rem',
              background: BRAND.gradient,
              color: '#000', border: 'none', borderRadius: '14px',
              fontSize: '1.05rem', fontWeight: '900', letterSpacing: '0.02em',
              cursor: 'pointer', fontFamily: FONT,
            }}
          >
            {result ? 'Scan Next' : 'Start Scanning'}
          </button>
        )}

        {scanning && (
          <button
            onClick={() => { stopScanner(); setResult(null) }}
            style={{
              width: '100%', padding: '1rem',
              background: 'transparent', color: C.textMid,
              border: `1px solid ${C.border}`, borderRadius: '14px',
              fontSize: '1rem', cursor: 'pointer', fontFamily: FONT,
            }}
          >
            Cancel
          </button>
        )}

        {/* Manual entry */}
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{ ...eyebrowStyle(C.textMid), fontSize: '0.65rem', marginBottom: '0.5rem' }}>Manual entry</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && manualInput.trim()) {
                  handleScan(manualInput.trim())
                  setManualInput('')
                }
              }}
              placeholder="Ticket # or ID"
              style={{
                flex: 1, padding: '0.85rem 1rem',
                background: '#0d0d14', border: `1px solid ${C.border}`,
                borderRadius: '10px', color: C.text, fontSize: '0.95rem',
                outline: 'none', fontFamily: FONT,
              }}
            />
            <button
              onClick={() => {
                if (manualInput.trim()) {
                  handleScan(manualInput.trim())
                  setManualInput('')
                }
              }}
              style={{
                padding: '0.85rem 1.25rem',
                background: BRAND.gradient,
                color: '#000', border: 'none', borderRadius: '10px',
                fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer', fontFamily: FONT,
              }}
            >
              Go
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
