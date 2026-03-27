import React, { useState, useEffect, useRef } from 'react'
import jsQR from 'jsqr'
import { supabase } from './supabase'


export default function ScanPage() {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null)
  const [admitting, setAdmitting] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const handledRef = useRef(false)

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
    } catch (err) {
      setResult({ status: 'error', message: 'Camera access denied. Check browser permissions.' })
    }
  }

  const tick = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    if (video.readyState < 2) {
      rafRef.current = requestAnimationFrame(tick)
      return
    }
    canvas.width = video.videoWidth
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

  const handleScan = async (text) => {
    const ticketNumber = parseInt(text.trim(), 10)
    if (isNaN(ticketNumber)) {
      setResult({ status: 'error', message: `Unrecognized QR: "${text}"` })
      return
    }
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('ticket_number', ticketNumber)
      .single()

    if (error || !data) {
      setResult({ status: 'not_found', ticketNumber })
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
      setTimeout(() => setResult(null), 3000)
    }
    setAdmitting(false)
  }

  useEffect(() => () => stopScanner(), [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0d0d',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '2rem 1rem',
      color: '#fff',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img
            src="https://elkfhmyhiyyubtqzqlpq.supabase.co/storage/v1/object/public/ticket-images/nonlinear%20outline.svg"
            alt="Nonlinear"
            style={{ width: '160px', filter: 'brightness(0) invert(1)', marginBottom: '0.5rem' }}
          />
          <div style={{ color: '#cd853f', fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Door Scanner
          </div>
        </div>

        {/* Hidden canvas for frame processing */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Live camera feed */}
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            display: scanning ? 'block' : 'none',
            width: '100%',
            borderRadius: '16px',
            marginBottom: '1rem',
            background: '#111',
          }}
        />

        {/* Result card */}
        {result && (
          <div style={{
            borderRadius: '16px',
            padding: '1.75rem',
            marginBottom: '1.5rem',
            textAlign: 'center',
            background:
              result.status === 'valid' ? 'rgba(76,175,80,0.1)' :
              result.status === 'admitted' ? 'rgba(76,175,80,0.2)' :
              result.status === 'already_torn' ? 'rgba(204,34,0,0.15)' :
              'rgba(255,100,50,0.1)',
            border: `2px solid ${
              result.status === 'valid' || result.status === 'admitted' ? '#4caf50' :
              result.status === 'already_torn' ? '#cc2200' : '#ff6432'
            }`,
          }}>
            {result.status === 'valid' && (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '0.25rem' }}>✓</div>
                <div style={{ color: '#4caf50', fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Valid Ticket</div>
                <div style={{ fontSize: '2rem', fontWeight: '900', color: '#d2691e', marginBottom: '0.25rem' }}>#{result.ticket.ticket_number}</div>
                <div style={{ fontSize: '1.2rem', fontWeight: '600', color: '#fff', marginBottom: '1.5rem' }}>{result.ticket.name}</div>
                <button
                  onClick={handleAdmit}
                  disabled={admitting}
                  style={{
                    width: '100%', padding: '1rem',
                    background: admitting ? '#333' : '#4caf50',
                    color: 'white', border: 'none', borderRadius: '12px',
                    fontSize: '1.1rem', fontWeight: '800', cursor: admitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {admitting ? 'Admitting...' : 'ADMIT'}
                </button>
              </>
            )}
            {result.status === 'admitted' && (
              <>
                <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>🎉</div>
                <div style={{ color: '#4caf50', fontSize: '1.2rem', fontWeight: '800' }}>ADMITTED</div>
                <div style={{ color: '#888', fontSize: '0.9rem', marginTop: '0.5rem' }}>{result.ticket?.name}</div>
              </>
            )}
            {result.status === 'already_torn' && (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '0.25rem' }}>⛔</div>
                <div style={{ color: '#cc2200', fontSize: '1rem', fontWeight: '800', marginBottom: '0.5rem' }}>ALREADY ADMITTED</div>
                <div style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.25rem' }}>#{result.ticket.ticket_number} — {result.ticket.name}</div>
                {result.ticket.torn_at && (
                  <div style={{ color: '#888', fontSize: '0.8rem' }}>
                    at {new Date(result.ticket.torn_at).toLocaleString('en-US', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </>
            )}
            {result.status === 'not_found' && (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '0.25rem' }}>❓</div>
                <div style={{ color: '#ff6432', fontSize: '1rem', fontWeight: '800', marginBottom: '0.5rem' }}>TICKET NOT FOUND</div>
                <div style={{ color: '#888', fontSize: '0.85rem' }}>#{result.ticketNumber} not found.</div>
              </>
            )}
            {result.status === 'error' && (
              <>
                <div style={{ fontSize: '3rem', marginBottom: '0.25rem' }}>⚠️</div>
                <div style={{ color: '#ff6432', fontSize: '0.95rem', marginTop: '0.5rem' }}>{result.message}</div>
              </>
            )}
          </div>
        )}

        {!scanning && (
          <button
            onClick={startScanner}
            style={{
              width: '100%', padding: '1.1rem',
              background: 'linear-gradient(45deg, #d2691e, #cd853f)',
              color: 'white', border: 'none', borderRadius: '14px',
              fontSize: '1.1rem', fontWeight: '800', letterSpacing: '0.05em',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(210,105,30,0.4)',
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
              background: 'transparent', color: '#888',
              border: '1px solid #333', borderRadius: '14px',
              fontSize: '1rem', cursor: 'pointer', marginTop: '0.5rem',
            }}
          >
            Cancel
          </button>
        )}

      </div>
    </div>
  )
}
