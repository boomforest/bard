import React, { useState, useEffect, useRef, useCallback } from 'react'
import jsQR from 'jsqr'
import { supabase } from './supabase'
import { grailStore } from './grailStore'

// ─── CAPACITY CONFIG ──────────────────────────────────────────────────────────
// TODO: pull from Supabase grail_events table
const CAPACITY = 300

// ─── SKY COLOR MATH ───────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)) }

function lerpColor(hex1, hex2, t) {
  const h = (s) => [parseInt(s.slice(1,3),16), parseInt(s.slice(3,5),16), parseInt(s.slice(5,7),16)]
  const [r1,g1,b1] = h(hex1)
  const [r2,g2,b2] = h(hex2)
  return `rgb(${Math.round(lerp(r1,r2,t))},${Math.round(lerp(g1,g2,t))},${Math.round(lerp(b1,b2,t))})`
}

// Key-framed sky states at 0 / 0.25 / 0.5 / 0.75 / 1.0
const SKY_FRAMES = [
  { pct: 0,    top: '#000000', bottom: '#050302' },
  { pct: 0.25, top: '#06061a', bottom: '#1a0700' },
  { pct: 0.5,  top: '#0c0c22', bottom: '#5a1e00' },
  { pct: 0.75, top: '#16122a', bottom: '#b85010' },
  { pct: 1.0,  top: '#1e1630', bottom: '#e8922a' },
]

function skyColors(pct) {
  let lo = SKY_FRAMES[0], hi = SKY_FRAMES[SKY_FRAMES.length - 1]
  for (let i = 0; i < SKY_FRAMES.length - 1; i++) {
    if (pct >= SKY_FRAMES[i].pct && pct <= SKY_FRAMES[i+1].pct) {
      lo = SKY_FRAMES[i]; hi = SKY_FRAMES[i+1]; break
    }
  }
  const t = lo.pct === hi.pct ? 1 : (pct - lo.pct) / (hi.pct - lo.pct)
  return {
    top:    lerpColor(lo.top,    hi.top,    t),
    bottom: lerpColor(lo.bottom, hi.bottom, t),
  }
}

// ─── STAR FIELD (generated once) ─────────────────────────────────────────────
const STARS = Array.from({ length: 220 }, (_, i) => ({
  id: i,
  x:    Math.random() * 100,
  y:    Math.random() * 75,   // top 75% of sky
  size: Math.random() < 0.15 ? 2.5 : Math.random() < 0.4 ? 1.8 : 1.2,
  twinkle: Math.random() > 0.7,
  delay: Math.random() * 3,
}))

// ─── SHOW MODE ────────────────────────────────────────────────────────────────
function ShowMode({ admitted, capacity, onSwitchToScan, demoMode, setDemoMode }) {
  const pct     = Math.min(admitted / capacity, 1)
  const dawn    = pct >= 1
  const { top, bottom } = skyColors(pct)
  const starOpacity = Math.max(0, 1 - pct * 2)
  const horizonGlow  = pct > 0.3 ? (pct - 0.3) / 0.7 : 0

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: `linear-gradient(to bottom, ${top} 0%, ${bottom} 100%)`,
      overflow: 'hidden',
      transition: 'background 4s ease',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Star field */}
      {STARS.map(star => (
        <div key={star.id} style={{
          position: 'absolute',
          left: `${star.x}%`,
          top:  `${star.y}%`,
          width:  star.size,
          height: star.size,
          borderRadius: '50%',
          background: '#fff',
          opacity: starOpacity * (star.twinkle ? 0.7 : 1),
          transition: 'opacity 3s ease',
          animation: star.twinkle ? `twinkle ${2 + star.delay}s ${star.delay}s infinite alternate` : 'none',
          pointerEvents: 'none',
        }} />
      ))}

      {/* Horizon glow */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: `${30 + horizonGlow * 50}%`,
        background: `radial-gradient(ellipse at 50% 100%, ${bottom}cc 0%, transparent 70%)`,
        transition: 'height 4s ease, background 4s ease',
        pointerEvents: 'none',
      }} />

      {/* Main content */}
      <div style={{ position: 'relative', textAlign: 'center', zIndex: 2, padding: '2rem' }}>

        {dawn ? (
          <>
            <div style={{
              fontSize: 'clamp(3rem, 10vw, 6rem)',
              fontWeight: '900',
              color: '#e8b84b',
              letterSpacing: '0.05em',
              textShadow: '0 0 60px rgba(232,184,75,0.8), 0 0 120px rgba(232,184,75,0.4)',
              marginBottom: '0.5rem',
              animation: 'fadeIn 2s ease',
            }}>
              DAWN BREAKS
            </div>
            <div style={{ color: '#c8922a', fontSize: 'clamp(1rem, 3vw, 1.5rem)', fontWeight: '600', opacity: 0.9 }}>
              {capacity} inside · doors closed
            </div>
          </>
        ) : (
          <>
            {/* Event name */}
            <div style={{
              color: 'rgba(232,224,208,0.6)',
              fontSize: 'clamp(0.7rem, 2vw, 0.9rem)',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              marginBottom: '0.75rem',
              fontWeight: '600',
            }}>
              Sunrise at Juarez
            </div>

            {/* The number */}
            <div style={{
              fontSize: 'clamp(5rem, 20vw, 14rem)',
              fontWeight: '900',
              color: pct > 0.5 ? '#e8b84b' : 'rgba(232,224,208,0.9)',
              lineHeight: 1,
              letterSpacing: '-0.02em',
              textShadow: pct > 0.5
                ? '0 0 40px rgba(232,184,75,0.5)'
                : '0 0 20px rgba(232,224,208,0.2)',
              transition: 'color 3s ease, text-shadow 3s ease',
              marginBottom: '0.25rem',
            }}>
              {admitted}
            </div>

            <div style={{
              color: 'rgba(232,224,208,0.45)',
              fontSize: 'clamp(1rem, 3vw, 1.6rem)',
              fontWeight: '500',
              marginBottom: '2.5rem',
              letterSpacing: '0.05em',
            }}>
              of {capacity} inside
            </div>

            {/* Capacity bar */}
            <div style={{
              width: 'min(400px, 80vw)',
              margin: '0 auto 2.5rem',
            }}>
              <div style={{
                height: '3px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '99px',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${pct * 100}%`,
                  background: pct > 0.75
                    ? 'linear-gradient(90deg, #c8922a, #e8b84b)'
                    : 'rgba(255,255,255,0.4)',
                  borderRadius: '99px',
                  transition: 'width 2s ease, background 3s ease',
                }} />
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '0.5rem',
                color: 'rgba(232,224,208,0.3)',
                fontSize: '0.7rem',
                letterSpacing: '0.1em',
              }}>
                <span>DOORS OPEN</span>
                <span style={{ color: pct > 0.8 ? '#e8b84b' : 'rgba(232,224,208,0.3)' }}>
                  {Math.round(capacity - admitted)} remaining
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Scan mode toggle — subtle, corner */}
      <button
        onClick={onSwitchToScan}
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '8px',
          color: 'rgba(232,224,208,0.5)',
          padding: '0.5rem 0.9rem',
          fontSize: '0.75rem',
          cursor: 'pointer',
          letterSpacing: '0.06em',
          zIndex: 10,
        }}
      >
        SCAN MODE
      </button>

      {/* Demo controls — remove before production */}
      <div style={{
        position: 'fixed',
        bottom: '1.5rem',
        left: '1.5rem',
        display: 'flex',
        gap: '0.5rem',
        zIndex: 10,
      }}>
        <button
          onClick={() => setDemoMode(d => !d)}
          style={{
            background: demoMode ? 'rgba(200,146,42,0.2)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${demoMode ? 'rgba(200,146,42,0.4)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '8px',
            color: demoMode ? '#c8922a' : 'rgba(232,224,208,0.4)',
            padding: '0.4rem 0.7rem',
            fontSize: '0.7rem',
            cursor: 'pointer',
          }}
        >
          {demoMode ? '⏸ Demo' : '▶ Demo'}
        </button>
      </div>

      <style>{`
        @keyframes twinkle { from { opacity: 0.4; } to { opacity: 1; } }
        @keyframes fadeIn  { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  )
}

// ─── SCAN MODE ────────────────────────────────────────────────────────────────
function ScanMode({ admitted, capacity, onSwitchToShow, onAdmit }) {
  const [scanning,    setScanning]    = useState(false)
  const [result,      setResult]      = useState(null)
  const [admitting,   setAdmitting]   = useState(false)
  const [manualInput, setManualInput] = useState('')
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const streamRef  = useRef(null)
  const rafRef     = useRef(null)
  const handledRef = useRef(false)

  const stopScanner = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setScanning(false)
  }, [])

  const tick = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    if (video.readyState < 2) { rafRef.current = requestAnimationFrame(tick); return }
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)
    const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' })
    if (code && !handledRef.current && !isNaN(parseInt(code.data.trim(), 10))) {
      handledRef.current = true
      stopScanner()
      handleScan(code.data)
    } else {
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [stopScanner])

  const startScanner = async () => {
    setResult(null)
    handledRef.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setScanning(true)
      tick()
    } catch {
      setResult({ status: 'error', message: 'Camera access denied.' })
    }
  }

  const handleScan = async (text) => {
    const num = parseInt(text.trim(), 10)
    if (isNaN(num)) { setResult({ status: 'error', message: `Unrecognized: "${text}"` }); return }
    // TODO: replace with real Supabase query
    const { data, error } = await supabase.from('tickets').select('*').eq('ticket_number', num).single()
    if (error || !data) { setResult({ status: 'not_found', ticketNumber: num }); return }
    setResult({ status: data.torn ? 'already_torn' : 'valid', ticket: data })
  }

  const handleAdmit = async () => {
    if (!result?.ticket) return
    setAdmitting(true)
    const { error } = await supabase.from('tickets').update({ torn: true, torn_at: new Date().toISOString() }).eq('id', result.ticket.id)
    if (!error) {
      onAdmit()   // increments counter in parent + grailStore
      setResult(prev => ({ ...prev, status: 'admitted' }))
      setTimeout(() => setResult(null), 2500)
    }
    setAdmitting(false)
  }

  useEffect(() => () => stopScanner(), [stopScanner])

  const C = {
    bg: '#080808', gold: '#c8922a', goldLight: '#e8b84b',
    green: '#22c55e', red: '#ef4444', text: '#e8e0d0', textMid: '#9a8878',
    border: '#1c1c1c', card: '#111',
  }
  const pct = Math.round((admitted / capacity) * 100)

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: C.text,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '1.5rem 1rem 2rem',
    }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Header */}
      <div style={{ width: '100%', maxWidth: '400px', marginBottom: '1.5rem' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.8rem',
        }}>
          <div>
            <div style={{ color: C.goldLight, fontWeight: '800', fontSize: '1rem' }}>Door — Scan</div>
            <div style={{ color: C.textMid, fontSize: '0.75rem' }}>Tap to admit</div>
          </div>
          <button
            onClick={onSwitchToShow}
            style={{
              background: 'transparent',
              border: `1px solid ${C.border}`,
              borderRadius: '7px',
              color: C.textMid,
              padding: '0.4rem 0.8rem',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Show Mode 🌅
          </button>
        </div>

        {/* Capacity pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.7rem',
          background: '#111',
          border: `1px solid ${C.border}`,
          borderRadius: '10px',
          padding: '0.6rem 1rem',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ height: '4px', background: '#222', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                background: pct > 90 ? C.red : pct > 70 ? C.gold : C.green,
                borderRadius: '99px',
                transition: 'width 1s ease',
              }} />
            </div>
          </div>
          <span style={{ color: C.text, fontWeight: '700', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
            {admitted} / {capacity}
          </span>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Camera */}
        <video
          ref={videoRef}
          playsInline muted
          style={{
            display: scanning ? 'block' : 'none',
            width: '100%',
            borderRadius: '14px',
            marginBottom: '1rem',
            background: '#111',
          }}
        />

        {/* Result */}
        {result && (
          <div style={{
            borderRadius: '16px',
            padding: '1.5rem',
            marginBottom: '1rem',
            textAlign: 'center',
            background: result.status === 'valid' ? 'rgba(34,197,94,0.08)' :
                        result.status === 'admitted' ? 'rgba(34,197,94,0.15)' :
                        result.status === 'already_torn' ? 'rgba(239,68,68,0.1)' :
                        'rgba(255,100,50,0.08)',
            border: `1.5px solid ${
              result.status === 'valid' || result.status === 'admitted' ? C.green :
              result.status === 'already_torn' ? C.red : '#ff6432'
            }`,
          }}>
            {result.status === 'valid' && (
              <>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>✓</div>
                <div style={{ color: C.green, fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Valid Ticket</div>
                <div style={{ fontSize: '1.8rem', fontWeight: '900', color: C.goldLight, marginBottom: '0.2rem' }}>#{result.ticket.ticket_number}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.2rem' }}>{result.ticket.name}</div>
                <button
                  onClick={handleAdmit}
                  disabled={admitting}
                  style={{
                    width: '100%', padding: '0.9rem',
                    background: admitting ? '#333' : C.green,
                    color: '#000', border: 'none', borderRadius: '10px',
                    fontSize: '1rem', fontWeight: '800', cursor: admitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {admitting ? 'Admitting...' : 'ADMIT'}
                </button>
              </>
            )}
            {result.status === 'admitted' && (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '0.3rem' }}>🌅</div>
                <div style={{ color: C.green, fontSize: '1.1rem', fontWeight: '800' }}>ADMITTED</div>
                <div style={{ color: C.textMid, fontSize: '0.9rem', marginTop: '0.3rem' }}>{result.ticket?.name}</div>
              </>
            )}
            {result.status === 'already_torn' && (
              <>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.3rem' }}>⛔</div>
                <div style={{ color: C.red, fontSize: '0.95rem', fontWeight: '800', marginBottom: '0.3rem' }}>Already Admitted</div>
                <div style={{ fontSize: '1rem', fontWeight: '600' }}>#{result.ticket.ticket_number} — {result.ticket.name}</div>
                {result.ticket.torn_at && (
                  <div style={{ color: C.textMid, fontSize: '0.75rem', marginTop: '0.2rem' }}>
                    {new Date(result.ticket.torn_at).toLocaleTimeString('en-US', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </>
            )}
            {result.status === 'not_found' && (
              <>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.3rem' }}>❓</div>
                <div style={{ color: '#ff6432', fontWeight: '800' }}>Not Found</div>
                <div style={{ color: C.textMid, fontSize: '0.8rem' }}>#{result.ticketNumber}</div>
              </>
            )}
            {result.status === 'error' && (
              <>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.3rem' }}>⚠</div>
                <div style={{ color: '#ff6432', fontSize: '0.9rem' }}>{result.message}</div>
              </>
            )}
          </div>
        )}

        {!scanning && (
          <button
            onClick={startScanner}
            style={{
              width: '100%', padding: '1rem',
              background: `linear-gradient(45deg, ${C.gold}, ${C.goldLight})`,
              color: '#000', border: 'none', borderRadius: '12px',
              fontSize: '1rem', fontWeight: '800', cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(200,146,42,0.35)',
              marginBottom: '0.5rem',
            }}
          >
            {result ? 'Scan Next' : 'Scan Ticket'}
          </button>
        )}
        {scanning && (
          <button
            onClick={() => { stopScanner(); setResult(null) }}
            style={{
              width: '100%', padding: '0.9rem',
              background: 'transparent', color: C.textMid,
              border: `1px solid ${C.border}`, borderRadius: '12px',
              fontSize: '0.95rem', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        )}

        {/* Manual entry */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <input
            type="number"
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && manualInput.trim()) { handleScan(manualInput.trim()); setManualInput('') } }}
            placeholder="Ticket # (manual)"
            style={{
              flex: 1, padding: '0.8rem',
              background: '#111', border: `1px solid ${C.border}`,
              borderRadius: '10px', color: C.text, fontSize: '0.95rem', outline: 'none',
            }}
          />
          <button
            onClick={() => { if (manualInput.trim()) { handleScan(manualInput.trim()); setManualInput('') } }}
            style={{
              padding: '0.8rem 1.1rem',
              background: C.gold, color: '#000', border: 'none',
              borderRadius: '10px', fontWeight: '700', cursor: 'pointer',
            }}
          >
            Go
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
export default function GrailDoor() {
  const [mode,     setMode]     = useState('show')   // 'show' | 'scan'
  const [admitted, setAdmitted] = useState(0)
  const [demoMode, setDemoMode] = useState(false)
  const demoRef = useRef(null)

  // Demo auto-advance (remove in production)
  useEffect(() => {
    if (demoMode) {
      demoRef.current = setInterval(() => {
        setAdmitted(n => {
          const next = Math.min(n + 1, CAPACITY)
          grailStore.setAdmittedCount(next)
          return next
        })
      }, 400)
    } else {
      clearInterval(demoRef.current)
    }
    return () => clearInterval(demoRef.current)
  }, [demoMode])

  // In production: subscribe to Supabase realtime on `tickets` where torn = true
  // const { count } = await supabase.from('tickets').select('id', { count: 'exact' }).eq('torn', true).eq('event_id', eventId)
  // grailStore.setAdmittedCount(count)

  const handleAdmit = () => {
    const next = admitted + 1
    setAdmitted(next)
    grailStore.setAdmittedCount(next)
  }

  return mode === 'show'
    ? <ShowMode
        admitted={admitted}
        capacity={CAPACITY}
        onSwitchToScan={() => setMode('scan')}
        demoMode={demoMode}
        setDemoMode={setDemoMode}
      />
    : <ScanMode
        admitted={admitted}
        capacity={CAPACITY}
        onSwitchToShow={() => setMode('show')}
        onAdmit={handleAdmit}
      />
}

// Also export for embedding in admin shell
export { ScanMode, ShowMode }
