import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCode } from 'react-qrcode-logo'

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg:       '#080808',
  surface:  '#0f0f0f',
  card:     '#131313',
  border:   '#1e1e1e',
  gold:     '#c8922a',
  goldLight:'#e8b84b',
  goldDim:  '#6b4a14',
  green:    '#22c55e',
  text:     '#f0ece4',
  textMid:  '#7a7060',
  textDim:  '#3a3028',
  red:      '#ef4444',
  neon:     '#aaff00',
}

// ─── DEMO TICKET DATA ─────────────────────────────────────────────────────────
const DEMO_TICKET = {
  event:    'Rooftop Party',
  date:     'Friday, May 2 · 10PM',
  venue:    'Atlanta Rooftop',
  tier:     'General Admission',
  holder:   'Marcus T.',
  code:     'GRL-4821',
}

const DEMO_MENU = [
  { id: 1, name: 'Suero',           price: 5,  img: '/drinks/suero.jpg',          desc: 'The morning after, before it starts' },
  { id: 2, name: 'Suero con Mezcal',price: 10, img: '/drinks/sueroconmezcal.jpg', desc: 'Smoke in the remedy'                 },
  { id: 3, name: 'Cerveza',         price: 6,  img: '/drinks/cerveza.jpg',         desc: 'Fría. Siempre fría.'                },
  { id: 4, name: 'Michelada',       price: 8,  img: '/drinks/michelada.jpg',       desc: 'Limón, sal, chamoy, fuego'          },
]

// ─── NONLINEAR QR CODE ────────────────────────────────────────────────────────
function NlnrQR({ code }) {
  const [logo, setLogo] = useState(null)

  useEffect(() => {
    fetch('https://elkfhmyhiyyubtqzqlpq.supabase.co/storage/v1/object/public/ticket-images/nlnr%20outline.svg')
      .then(r => r.text())
      .then(svg => {
        const white = svg
          .replace(/fill="#000000"/gi, 'fill="#ffffff"')
          .replace(/fill="black"/gi,  'fill="#ffffff"')
          .replace(/width="2048px"/,  'width="100%"')
          .replace(/height="1335px"/, 'height="100%"')
          .replace('<svg ',           '<svg viewBox="610 490 810 340" ')
        setLogo('data:image/svg+xml;base64,' + btoa(white))
      })
      .catch(() => {})
  }, [])

  return (
    <QRCode
      value={code}
      size={140}
      bgColor="#130800"
      fgColor="#d2691e"
      qrStyle="squares"
      eyeRadius={6}
      logoImage={logo || undefined}
      logoWidth={38}
      logoHeight={16}
      logoOpacity={0.8}
      removeQrCodeBehindLogo={true}
      level="L"
      style={{ display: 'block' }}
    />
  )
}

// ─── BAR SHEET ────────────────────────────────────────────────────────────────
const LOAD_PRESETS = [50, 100, 200, 500]

function BarSheet({ onClose }) {
  const [balance,   setBalance]   = useState(0)
  const [cart,      setCart]      = useState({})
  const [ordered,   setOrdered]   = useState(false)
  const [name,      setName]      = useState('')
  const [showName,  setShowName]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [loadAmt,   setLoadAmt]   = useState(100)
  const [loadDone,  setLoadDone]  = useState(false)
  const [redeemed,  setRedeemed]  = useState({}) // { itemId: countRedeemed }

  const total     = DEMO_MENU.reduce((s, i) => s + (cart[i.id] || 0) * i.price, 0)
  const count     = Object.values(cart).reduce((s, q) => s + q, 0)
  const canAfford = item => balance >= item.price

  // Expand cart into flat list of individual drink tickets for redemption
  const orderItems = Object.entries(cart).flatMap(([id, qty]) => {
    const item = DEMO_MENU.find(i => i.id === Number(id))
    return Array.from({ length: qty }, (_, i) => ({ ...item, key: `${id}-${i}` }))
  })
  const totalRedeemed = Object.values(redeemed).reduce((s, n) => s + n, 0)
  const allRedeemed   = ordered && totalRedeemed >= orderItems.length

  const add = id => {
    const item = DEMO_MENU.find(i => i.id === id)
    if (!canAfford(item)) return
    setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }))
  }
  const rem = id => setCart(c => {
    const n = { ...c }
    if (n[id] > 1) { n[id]-- } else { delete n[id] }
    return n
  })

  const handleLoad = () => {
    setLoading(true)
    setTimeout(() => {
      setBalance(b => b + loadAmt)
      setLoadDone(true)
      setTimeout(() => { setLoading(false); setLoadDone(false) }, 1200)
    }, 900)
  }

  const place = () => {
    if (!name.trim()) { setShowName(true); return }
    setBalance(b => b - total)
    setOrdered(true)
  }

  const redeem = id => {
    setRedeemed(r => {
      const done  = r[id] || 0
      const total = cart[id] || 0
      if (done >= total) return r
      return { ...r, [id]: done + 1 }
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />

      <div style={{
        position: 'relative', background: C.card, width: '100%', maxWidth: '480px',
        borderRadius: '22px 22px 0 0', border: `1px solid ${C.border}`, borderBottom: 'none',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: '36px', height: '4px', background: C.border, borderRadius: '99px' }} />
        </div>

        {/* ── REDEMPTION SCREEN ─────────────────────────────── */}
        {ordered ? (
          allRedeemed ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🕊</div>
              <div style={{ color: C.green, fontSize: '1.4rem', fontWeight: '800', marginBottom: '0.4rem' }}>All drinks handed over</div>
              <div style={{ color: C.textMid, fontSize: '0.85rem', marginBottom: '2rem' }}>Enjoy the show, {name}.</div>
              <button onClick={onClose} style={{ background: C.gold, color: '#000', border: 'none', borderRadius: '10px', padding: '0.8rem 2rem', fontWeight: '700', cursor: 'pointer' }}>
                Back to ticket
              </button>
            </div>
          ) : (
            <>
              {/* Redemption header */}
              <div style={{ padding: '0.9rem 1.2rem', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                <div style={{ color: C.textMid, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.15rem' }}>
                  Hand this to the bartender
                </div>
                <div style={{ color: C.text, fontWeight: '800', fontSize: '1rem' }}>
                  {name}'s order · {totalRedeemed}/{orderItems.length} handed over
                </div>
              </div>

              {/* Per-item redeem cards */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {DEMO_MENU.filter(item => (cart[item.id] || 0) > 0).map(item => {
                  const qty  = cart[item.id]
                  const done = redeemed[item.id] || 0
                  const remaining = qty - done
                  return (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.85rem',
                      background: remaining === 0 ? '#0a120a' : '#111',
                      border: `1px solid ${remaining === 0 ? '#2a5a2a' : C.border}`,
                      borderRadius: '14px', overflow: 'hidden',
                      transition: 'all 0.2s',
                    }}>
                      <img src={item.img} alt={item.name} style={{ width: '72px', height: '72px', objectFit: 'cover', flexShrink: 0 }} />
                      <div style={{ flex: 1, padding: '0.5rem 0' }}>
                        <div style={{ fontWeight: '700', fontSize: '0.9rem', color: remaining === 0 ? '#6abf4b' : C.text }}>{item.name}</div>
                        <div style={{ fontSize: '0.72rem', color: C.textMid, marginTop: '0.1rem' }}>
                          {remaining === 0 ? 'All handed over' : `${done > 0 ? `${done} done · ` : ''}${remaining} remaining`}
                        </div>
                      </div>
                      <div style={{ padding: '0 1rem', flexShrink: 0 }}>
                        {remaining > 0 ? (
                          <button
                            onClick={() => redeem(item.id)}
                            style={{
                              background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`,
                              color: '#000', border: 'none', borderRadius: '10px',
                              padding: '0.6rem 1.1rem', fontWeight: '800', fontSize: '0.85rem',
                              cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                          >
                            Redeem
                          </button>
                        ) : (
                          <div style={{ color: '#6abf4b', fontSize: '1.2rem' }}>✓</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ padding: '0.75rem 1.2rem 1.2rem', borderTop: `1px solid ${C.border}`, flexShrink: 0, textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: C.textMid }}>
                  Bartender taps Redeem as each drink is handed over
                </div>
              </div>
            </>
          )
        ) : (
          <>
            {/* ── MENU / ORDER FLOW ─────────────────────────── */}

            {/* Dove balance header */}
            <div style={{
              padding: '0.6rem 1.2rem 0.8rem',
              background: 'linear-gradient(135deg, #0d0800, #1a1000)',
              borderBottom: `1px solid ${C.goldDim}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: '0.62rem', color: C.goldDim, textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: '700', marginBottom: '0.1rem' }}>
                  🕊 Dove Balance
                </div>
                <div style={{ color: balance > 0 ? C.goldLight : C.textMid, fontSize: '1.6rem', fontWeight: '900', lineHeight: 1 }}>
                  {balance}
                  <span style={{ fontSize: '0.78rem', color: C.goldDim, fontWeight: '600', marginLeft: '0.3rem' }}>doves</span>
                </div>
                <div style={{ color: C.textMid, fontSize: '0.68rem', marginTop: '0.1rem' }}>
                  Charged now · unused doves refunded within 24 hours
                </div>
              </div>
              <button
                onClick={() => setLoading(l => !l)}
                style={{
                  background: C.gold, color: '#000', border: 'none',
                  borderRadius: '10px', padding: '0.55rem 1rem',
                  fontWeight: '800', fontSize: '0.82rem', cursor: 'pointer', flexShrink: 0,
                }}
              >
                + Load
              </button>
            </div>

            {/* Load panel */}
            {loading && (
              <div style={{ background: '#0f0a00', borderBottom: `1px solid ${C.goldDim}`, padding: '0.9rem 1.2rem', flexShrink: 0 }}>
                {loadDone ? (
                  <div style={{ textAlign: 'center', color: C.green, fontWeight: '800', padding: '0.4rem 0' }}>
                    {loadAmt} Doves loaded
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: '0.68rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.55rem' }}>
                      Select amount to load
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginBottom: '0.7rem' }}>
                      {LOAD_PRESETS.map(p => (
                        <button key={p} onClick={() => setLoadAmt(p)} style={{
                          padding: '0.55rem 0.3rem', borderRadius: '8px', border: `1px solid ${loadAmt === p ? C.gold : C.border}`,
                          background: loadAmt === p ? '#1a1000' : C.card,
                          color: loadAmt === p ? C.goldLight : C.textMid,
                          fontWeight: loadAmt === p ? '700' : '500', fontSize: '0.82rem', cursor: 'pointer',
                        }}>
                          {p} 🕊
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: C.textMid, marginBottom: '0.6rem' }}>
                      Card charged <strong style={{ color: C.text }}>${loadAmt}</strong> now. Any unused doves are automatically refunded within 24 hours.
                    </div>
                    <button onClick={handleLoad} style={{
                      width: '100%', background: C.gold, color: '#000', border: 'none',
                      borderRadius: '8px', padding: '0.7rem', fontWeight: '800', fontSize: '0.88rem', cursor: 'pointer',
                    }}>
                      Load ${loadAmt}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Bar header row */}
            <div style={{ padding: '0.65rem 1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <div style={{ color: C.goldLight, fontWeight: '800', fontSize: '0.95rem' }}>Rooftop Bar</div>
              {count > 0 && (
                <div style={{ background: C.goldDim, border: `1px solid ${C.gold}`, borderRadius: '99px', padding: '0.18rem 0.6rem', fontSize: '0.7rem', color: C.goldLight, fontWeight: '800' }}>
                  {count} in cart · 🕊 {total}
                </div>
              )}
            </div>

            {/* Menu — 2-col photo grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.8rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                {DEMO_MENU.map(item => {
                  const qty    = cart[item.id] || 0
                  const afford = canAfford(item)
                  return (
                    <div key={item.id} style={{
                      background: qty > 0 ? '#0d0d18' : '#111',
                      border: `1px solid ${qty > 0 ? C.gold + '55' : C.border}`,
                      borderRadius: '12px', overflow: 'hidden',
                      opacity: afford || qty > 0 ? 1 : 0.45,
                      transition: 'border-color 0.15s, opacity 0.2s',
                    }}>
                      <img src={item.img} alt={item.name} style={{ width: '100%', height: '85px', objectFit: 'cover', display: 'block' }} />
                      <div style={{ padding: '0.6rem 0.7rem 0.7rem' }}>
                        <div style={{ fontWeight: '700', fontSize: '0.85rem', color: C.text, marginBottom: '0.1rem' }}>{item.name}</div>
                        <div style={{ fontSize: '0.68rem', color: C.textMid, marginBottom: '0.5rem', lineHeight: 1.3 }}>{item.desc}</div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: '700', fontSize: '0.85rem', color: qty > 0 ? C.goldLight : C.gold }}>🕊 {item.price}</span>
                          {qty === 0 ? (
                            <button
                              onClick={() => add(item.id)}
                              disabled={!afford}
                              style={{ background: afford ? `linear-gradient(135deg, ${C.gold}, ${C.goldLight})` : '#222', color: afford ? '#000' : C.textMid, border: 'none', borderRadius: '6px', padding: '0.25rem 0.65rem', fontSize: '0.75rem', fontWeight: '700', cursor: afford ? 'pointer' : 'not-allowed' }}
                            >
                              {afford ? 'ADD' : 'Load'}
                            </button>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <button onClick={() => rem(item.id)} style={{ background: '#222', border: 'none', color: C.text, borderRadius: '4px', width: '22px', height: '22px', cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1 }}>−</button>
                              <span style={{ color: C.goldLight, fontWeight: '800', fontSize: '0.85rem', minWidth: '14px', textAlign: 'center' }}>{qty}</span>
                              <button onClick={() => add(item.id)} style={{ background: '#222', border: 'none', color: C.text, borderRadius: '4px', width: '22px', height: '22px', cursor: 'pointer', fontSize: '0.9rem', lineHeight: 1 }}>+</button>
                            </div>
                          )}
                        </div>
                        {!afford && balance > 0 && (
                          <div style={{ fontSize: '0.6rem', color: C.red, marginTop: '0.3rem' }}>Need {item.price - balance} more doves</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Footer */}
            {count > 0 && (
              <div style={{ padding: '0.8rem 1rem 1.5rem', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
                {showName && (
                  <input
                    autoFocus
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && place()}
                    placeholder="Your name so the bartender can call you"
                    style={{ width: '100%', background: '#1a1a1a', border: `1px solid ${C.goldDim}`, borderRadius: '8px', color: C.text, padding: '0.7rem', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', marginBottom: '0.6rem', fontFamily: 'inherit' }}
                  />
                )}
                <button
                  onClick={place}
                  disabled={balance < total}
                  style={{
                    width: '100%',
                    background: balance >= total ? `linear-gradient(135deg, ${C.gold}, ${C.goldLight})` : '#333',
                    color: balance >= total ? '#000' : C.textMid,
                    border: 'none', borderRadius: '12px', padding: '0.95rem',
                    fontSize: '1rem', fontWeight: '800',
                    cursor: balance >= total ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <span>{showName ? 'Place Order' : 'Order Now'}</span>
                  <span>🕊 {total}</span>
                </button>
                {balance < total && (
                  <div style={{ textAlign: 'center', fontSize: '0.75rem', color: C.red, marginTop: '0.5rem' }}>
                    Load {total - balance} more doves to place this order
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── FAN TICKET VIEW ─────────────────────────────────────────────────────────
function FanView() {
  const [barOpen, setBarOpen] = useState(false)

  return (
    <div style={{
      minHeight: '100dvh',
      background: C.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      position: 'relative',
    }}>
      {/* Logo */}
      <div style={{
        width: '80px', height: '80px', borderRadius: '50%', marginBottom: '1.5rem',
        background: 'linear-gradient(135deg, #c8922a, #e8b84b)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: '#000', fontWeight: '900', fontSize: '1rem', letterSpacing: '-0.02em' }}>GRAIL</span>
      </div>

      {/* Ticket card */}
      <div style={{
        width: '100%', maxWidth: '360px',
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>
        {/* Flyer strip */}
        <div style={{ position: 'relative', height: '140px', overflow: 'hidden' }}>
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1a0a2e 0%, #0d1a2e 40%, #1a0d08 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(19,19,19,0.95) 100%)' }} />
          <div style={{ position: 'absolute', bottom: '0.75rem', left: '1rem', right: '1rem' }}>
            <div style={{ color: C.text, fontWeight: '800', fontSize: '1.3rem', lineHeight: 1 }}>
              {DEMO_TICKET.event}
            </div>
            <div style={{ color: C.textMid, fontSize: '0.75rem', marginTop: '0.25rem' }}>
              {DEMO_TICKET.date}
            </div>
          </div>
        </div>

        {/* Venue + tier */}
        <div style={{ padding: '1rem 1.2rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '0.65rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.2rem' }}>Venue</div>
              <div style={{ color: C.text, fontWeight: '600', fontSize: '0.88rem' }}>{DEMO_TICKET.venue}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.65rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.2rem' }}>Tier</div>
              <div style={{ color: C.goldLight, fontWeight: '700', fontSize: '0.88rem' }}>{DEMO_TICKET.tier}</div>
            </div>
          </div>
        </div>

        {/* Perforated divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0', padding: '0 1.2rem', gap: '0.3rem' }}>
          <div style={{ flex: 1, borderTop: `1.5px dashed ${C.border}` }} />
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: C.bg, border: `1px solid ${C.border}`, flexShrink: 0 }} />
          <div style={{ flex: 1, borderTop: `1.5px dashed ${C.border}` }} />
        </div>

        {/* QR + holder */}
        <div style={{ padding: '0 1.2rem 1.2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ flexShrink: 0 }}>
            <NlnrQR code={DEMO_TICKET.code} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.65rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.3rem' }}>Ticket holder</div>
            <div style={{ color: C.text, fontWeight: '700', fontSize: '0.95rem' }}>{DEMO_TICKET.holder}</div>
            <div style={{ fontSize: '0.65rem', color: C.textMid, marginTop: '0.5rem', letterSpacing: '0.08em' }}>{DEMO_TICKET.code}</div>
            <div style={{ marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.62rem', background: '#0a1400', border: '1px solid #2a5a1a', color: '#6abf4b', borderRadius: '4px', padding: '0.15rem 0.45rem', fontWeight: '700' }}>
                Doves active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bar button */}
      <button
        onClick={() => setBarOpen(true)}
        style={{
          marginTop: '1.5rem',
          width: '100%',
          maxWidth: '360px',
          background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`,
          color: '#000',
          border: 'none',
          borderRadius: '14px',
          padding: '1rem',
          fontSize: '1rem',
          fontWeight: '800',
          cursor: 'pointer',
        }}
      >
        Order from the Bar
      </button>

      <div style={{ color: C.textMid, fontSize: '0.72rem', marginTop: '0.75rem', textAlign: 'center' }}>
        Charged now · unused doves refunded within 24 hours
      </div>

      {barOpen && <BarSheet onClose={() => setBarOpen(false)} />}
    </div>
  )
}

// ─── ROLE CARDS ────────────────────────────────────────────────────────────────
function RoleCard({ label, desc, cta, onClick, accent }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      style={{
        background: hov ? '#161616' : C.card,
        border: `1px solid ${hov ? accent : C.border}`,
        borderRadius: '16px',
        padding: '1.5rem',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s',
        outline: 'none',
        width: '100%',
      }}
    >
      <div style={{ color: C.text, fontWeight: '800', fontSize: '1rem', marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ color: C.textMid, fontSize: '0.82rem', lineHeight: 1.5, marginBottom: '1rem' }}>{desc}</div>
      <div style={{ color: accent, fontWeight: '700', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        {cta} <span>→</span>
      </div>
    </button>
  )
}

// ─── SIGNUP FORM ──────────────────────────────────────────────────────────────
function SignupForm({ role, onBack }) {
  const [email, setEmail] = useState('')
  const [name,  setName]  = useState('')
  const [done,  setDone]  = useState(false)

  const labelColor = role === 'Promoter' ? C.goldLight : '#b57bff'

  const submit = e => {
    e.preventDefault()
    if (!email.trim()) return
    setDone(true)
    // TODO: insert to Supabase waitlist table
  }

  if (done) return (
    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
      <div style={{ color: C.text, fontWeight: '800', fontSize: '1.1rem', marginBottom: '0.4rem' }}>You're on the list</div>
      <div style={{ color: C.textMid, fontSize: '0.85rem', marginBottom: '1.5rem' }}>
        We'll reach out when {role === 'Promoter' ? 'GRAIL is ready for your first event' : 'your first show is live'}.
      </div>
      <button onClick={onBack} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid, borderRadius: '8px', padding: '0.6rem 1.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
        ← Back
      </button>
    </div>
  )

  return (
    <div>
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: C.textMid, cursor: 'pointer', fontSize: '0.82rem', marginBottom: '1.2rem', padding: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        ← Back
      </button>
      <div style={{ fontSize: '0.65rem', color: labelColor, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: '700', marginBottom: '0.4rem' }}>
        {role} Signup
      </div>
      <div style={{ color: C.text, fontWeight: '800', fontSize: '1.2rem', marginBottom: '1.5rem' }}>
        {role === 'Promoter' ? 'Get early access.' : 'Get notified when shows go live.'}
      </div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Name"
          style={{ background: '#111', border: `1px solid ${C.border}`, borderRadius: '10px', color: C.text, padding: '0.8rem 1rem', fontSize: '0.95rem', outline: 'none', fontFamily: 'inherit' }}
        />
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email"
          style={{ background: '#111', border: `1px solid ${C.border}`, borderRadius: '10px', color: C.text, padding: '0.8rem 1rem', fontSize: '0.95rem', outline: 'none', fontFamily: 'inherit' }}
        />
        {role === 'Promoter' && (
          <input
            placeholder="Your city / market"
            style={{ background: '#111', border: `1px solid ${C.border}`, borderRadius: '10px', color: C.text, padding: '0.8rem 1rem', fontSize: '0.95rem', outline: 'none', fontFamily: 'inherit' }}
          />
        )}
        <button type="submit" style={{
          background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`,
          color: '#000', border: 'none', borderRadius: '10px',
          padding: '0.95rem', fontSize: '1rem', fontWeight: '800',
          cursor: 'pointer', marginTop: '0.25rem',
        }}>
          Join the waitlist
        </button>
      </form>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function GrailHome() {
  const navigate  = useNavigate()
  const [view, setView] = useState('home') // home | fan | promoter-signup | fan-signup

  if (view === 'fan') return <FanView />

  return (
    <div style={{
      minHeight: '100dvh',
      background: C.bg,
      color: C.text,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '3rem 1.5rem 4rem',
      maxWidth: '480px',
      margin: '0 auto',
    }}>
      {/* Logo */}
      <div style={{
        width: '72px', height: '72px', borderRadius: '50%', marginBottom: '1.2rem',
        background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color: '#000', fontWeight: '900', fontSize: '1rem', letterSpacing: '-0.02em' }}>GRAIL</span>
      </div>
      <div style={{ color: C.textMid, fontSize: '0.82rem', textAlign: 'center', marginBottom: '3rem', lineHeight: 1.6, maxWidth: '300px' }}>
        Event infrastructure built by musicians.<br />2% flat. No lock-in.
      </div>

      {view === 'home' && (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <RoleCard
            label="I'm a Promoter"
            desc="Build your event contract, sell tickets, manage the bar, and settle with your partners — all in one place."
            cta="Join the waitlist"
            accent={C.goldLight}
            onClick={() => setView('promoter-signup')}
          />
          <RoleCard
            label="I'm a Fan"
            desc="See your ticket, order drinks from your phone, and pay after the show. No app download required."
            cta="See how it works"
            accent="#b57bff"
            onClick={() => setView('fan')}
          />
          <RoleCard
            label="Show me a demo"
            desc="Walk through a full event — contract, bar, door, and settlement."
            cta="Open the demo"
            accent="#5b9bff"
            onClick={() => navigate('/demo')}
          />
        </div>
      )}

      {view === 'promoter-signup' && (
        <div style={{ width: '100%' }}>
          <SignupForm role="Promoter" onBack={() => setView('home')} />
        </div>
      )}

      {view === 'fan-signup' && (
        <div style={{ width: '100%' }}>
          <SignupForm role="Fan" onBack={() => setView('home')} />
        </div>
      )}

      {/* Footer */}
      {view === 'home' && (
        <div style={{ marginTop: '2.5rem', color: C.textDim, fontSize: '0.72rem', textAlign: 'center' }}>
          A musician-run nonprofit · 2% on tickets and bar
        </div>
      )}
    </div>
  )
}
