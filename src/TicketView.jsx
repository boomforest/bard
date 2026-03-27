import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabase'
import { QRCode } from 'react-qrcode-logo'

// Mexico City timezone: UTC-6 (no DST)
// Reveal time: midnight April 11 2026 CDMX = 2026-04-11T06:00:00Z
const REVEAL_UTC = new Date('2026-04-11T06:00:00Z');
const REAL_ADDRESS = 'Alvarez de Icaza 13';
const HINT_ADDRESS = 'Less than 10 minutes from Condesa/Roma';

function isAddressRevealed() {
  return new Date() >= REVEAL_UTC;
}

export default function TicketView() {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revealed, setRevealed] = useState(isAddressRevealed());
  const [tearing, setTearing] = useState(false);
  const [tornCount, setTornCount] = useState(null);
  const [whiteNlnrLogo, setWhiteNlnrLogo] = useState(null);

  useEffect(() => {
    fetch('https://elkfhmyhiyyubtqzqlpq.supabase.co/storage/v1/object/public/ticket-images/nlnr%20outline.svg')
      .then(r => r.text())
      .then(svg => {
        const white = svg
          .replace(/fill="#000000"/gi, 'fill="#ffffff"')
          .replace(/fill="black"/gi, 'fill="#ffffff"')
          // Remove fixed dimensions so it scales to the container
          .replace(/width="2048px"/, 'width="100%"')
          .replace(/height="1335px"/, 'height="100%"')
          // Crop viewBox tight to just the letters (x:610-1420, y:490-820)
          .replace('<svg ', '<svg viewBox="610 490 810 340" ');
        setWhiteNlnrLogo('data:image/svg+xml;base64,' + btoa(white));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (ticketId) fetchTicket();
  }, [ticketId]);

  // Poll for reveal time if not yet revealed
  useEffect(() => {
    if (revealed) return;
    const checkReveal = setInterval(() => {
      if (isAddressRevealed()) {
        setRevealed(true);
        clearInterval(checkReveal);
      }
    }, 30000);
    return () => clearInterval(checkReveal);
  }, [revealed]);

  const fetchTicket = async () => {
    setLoading(true);
    const { data: ticketData, error: ticketError } = await supabase
      .from('tickets')
      .select('*, events(*)')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticketData) {
      setError('Ticket not found. Check your link and try again.');
      setLoading(false);
      return;
    }

    setTicket(ticketData);
    setEvent(ticketData.events);
    setLoading(false);
  };

  const handleTear = async () => {
    if (!ticket || ticket.torn || tearing) return;

    setTearing(true);
    const { error } = await supabase
      .from('tickets')
      .update({ torn: true, torn_at: new Date().toISOString() })
      .eq('id', ticket.id);

    if (!error) {
      setTicket(prev => ({ ...prev, torn: true, torn_at: new Date().toISOString() }));
      // Fetch live torn count for this event
      const { count } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', ticket.event_id)
        .eq('torn', true);
      setTornCount(count);
    }
    setTearing(false);
  };

  const capacity = event?.capacity || 250;

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0d0d0d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#555',
        fontFamily: 'system-ui, sans-serif',
      }}>
        Loading ticket...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0d0d0d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '16px',
          padding: '2rem',
          textAlign: 'center',
          maxWidth: '360px',
        }}>
          <div style={{ color: '#ff6b6b', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Ticket Not Found</div>
          <div style={{ color: '#666', fontSize: '0.9rem' }}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0d0d0d 0%, #1a0800 60%, #0d0d0d 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>

      {/* Ticket card */}
      <div style={{
        width: '100%',
        maxWidth: '360px',
        position: 'relative',
      }}>

        {/* Torn state — full replacement view */}
        {ticket?.torn && (
          <div style={{
            borderRadius: '20px',
            overflow: 'hidden',
            position: 'relative',
          }}>
            <img
              src="https://elkfhmyhiyyubtqzqlpq.supabase.co/storage/v1/object/public/ticket-images/ticket-1757348111626.jpg"
              alt="Nonlinear"
              style={{ width: '100%', display: 'block' }}
            />
            {/* Big number overlay */}
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.55)',
            }}>
              {tornCount !== null && (
                <div style={{
                  fontSize: '8rem',
                  fontWeight: '900',
                  color: '#fff',
                  lineHeight: 1,
                  textShadow: '0 0 40px rgba(210,105,30,0.9)',
                }}>
                  {tornCount}
                </div>
              )}
              <div style={{
                color: '#d2691e',
                fontSize: '1rem',
                fontWeight: '700',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginTop: '0.5rem',
              }}>
                admitted tonight
              </div>
              <div style={{
                border: '3px solid #cc2200',
                borderRadius: '6px',
                padding: '0.3rem 1.2rem',
                color: '#cc2200',
                fontSize: '1.4rem',
                fontWeight: '900',
                letterSpacing: '0.15em',
                marginTop: '1.5rem',
                textShadow: '0 0 10px rgba(204,34,0,0.6)',
              }}>
                ADMITTED
              </div>
            </div>
          </div>
        )}

        {/* Main ticket */}
        <div style={{
          background: 'linear-gradient(180deg, #1a0800 0%, #200e00 100%)',
          border: '1px solid #4a2800',
          borderRadius: '20px 20px 0 0',
          padding: '2rem 1.75rem 1.5rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Background texture lines */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.04,
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 20px, #fff 20px, #fff 21px)',
            pointerEvents: 'none',
          }} />

          <div style={{
            fontSize: '0.65rem',
            letterSpacing: '0.3em',
            color: '#cd853f',
            textTransform: 'uppercase',
            marginBottom: '1rem',
          }}>
            Secret Show — CDMX
          </div>

          <img
            src="https://elkfhmyhiyyubtqzqlpq.supabase.co/storage/v1/object/public/ticket-images/nonlinear%20outline.svg"
            alt="Nonlinear"
            style={{ width: '100%', display: 'block', margin: '0 auto 1rem auto', filter: 'brightness(0) invert(1)' }}
          />

          <h1 style={{
            fontSize: '1rem',
            fontWeight: '700',
            color: '#cd853f',
            margin: '0 0 0.5rem 0',
            letterSpacing: '0.3em',
            lineHeight: 1,
            textTransform: 'uppercase',
          }}>
            NONLINEAR
          </h1>

          <div style={{ width: '40px', height: '2px', background: '#d2691e', margin: '1rem auto' }} />

          <div style={{ color: '#e8d5b0', fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
            Friday, April 11 — 2026
          </div>
          <div style={{ color: '#cd853f', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            10:00 PM — Sunrise
          </div>

          {/* Address reveal */}
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '1rem',
            marginBottom: '1rem',
          }}>
            {revealed ? (
              <>
                <div style={{ color: '#4caf50', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.4rem' }}>
                  Address Revealed
                </div>
                <div style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '700' }}>
                  {REAL_ADDRESS}
                </div>
                <div style={{ color: '#999', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  Mexico City
                </div>
              </>
            ) : (
              <>
                <div style={{ color: '#cd853f', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.4rem' }}>
                  Location
                </div>
                <div style={{ color: '#e8d5b0', fontSize: '0.95rem' }}>
                  {HINT_ADDRESS}
                </div>
                <div style={{ color: '#555', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                  Full address revealed at midnight April 11
                </div>
              </>
            )}
          </div>
        </div>

        {/* Perforated tear line */}
        <div style={{
          background: '#0d0d0d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          height: '24px',
          position: 'relative',
        }}>
          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#0d0d0d', marginLeft: '-24px', flexShrink: 0 }} />
          <div style={{
            flex: 1,
            borderTop: '2px dashed #2a1500',
          }} />
          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#0d0d0d', marginRight: '-24px', flexShrink: 0 }} />
        </div>

        {/* Ticket stub */}
        <div style={{
          background: 'linear-gradient(180deg, #1a0a00 0%, #130800 100%)',
          border: '1px solid #4a2800',
          borderTop: 'none',
          borderRadius: '0 0 20px 20px',
          padding: '1.25rem 1.75rem',
          textAlign: 'center',
          position: 'relative',
        }}>
          {/* Ticket number */}
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{
              fontSize: '1.4rem',
              fontWeight: '900',
              color: '#d2691e',
              letterSpacing: '0.05em',
            }}>
              TICKET #{ticket?.ticket_number} <span style={{ color: '#444', fontWeight: '400', fontSize: '0.9rem' }}>of {capacity}</span>
            </div>
          </div>

          {/* QR Code */}
          <QRCode
            value={`${ticket?.ticket_number}`}
            size={160}
            bgColor="#130800"
            fgColor="#d2691e"
            qrStyle="squares"
            eyeRadius={6}
            logoImage={whiteNlnrLogo || 'https://elkfhmyhiyyubtqzqlpq.supabase.co/storage/v1/object/public/ticket-images/nlnr%20outline.svg'}
            logoWidth={28}
            logoHeight={28}
            logoOpacity={0.75}
            removeQrCodeBehindLogo={true}
            level="L"
            style={{ display: 'block', margin: '0 auto 1rem auto' }}
          />

          {/* Name */}
          <div style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>
            Holder
          </div>
          <div style={{ color: '#e8d5b0', fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>
            {ticket?.name}
          </div>

          {/* UUID (shortened) */}
          <div style={{ color: '#333', fontSize: '0.6rem', letterSpacing: '0.05em', marginBottom: '0.5rem', wordBreak: 'break-all' }}>
            {ticket?.id}
          </div>

          {/* Invisible tear button — see spec: no label, no styling, 60x30px */}
          {!ticket?.torn && (
            <button
              onClick={handleTear}
              disabled={tearing}
              aria-label="Tear ticket"
              style={{
                position: 'absolute',
                bottom: '0',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '60px',
                height: '30px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                outline: 'none',
                padding: 0,
              }}
            />
          )}
        </div>

        {/* Torn-at timestamp */}
        {ticket?.torn && ticket?.torn_at && (
          <div style={{
            textAlign: 'center',
            color: '#cc2200',
            fontSize: '0.75rem',
            marginTop: '0.75rem',
            opacity: 0.7,
          }}>
            Torn at {new Date(ticket.torn_at).toLocaleString('en-US', { timeZone: 'America/Mexico_City' })}
          </div>
        )}

        {/* Instructions */}
        {!ticket?.torn && (
          <div style={{
            textAlign: 'center',
            color: '#2a1500',
            fontSize: '0.7rem',
            marginTop: '0.75rem',
          }}>
            Show this screen at the door
          </div>
        )}
      </div>
    </div>
  );
}
