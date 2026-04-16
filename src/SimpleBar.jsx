import React, { useState } from 'react'

// ─── BRAND ────────────────────────────────────────────────────────────────────
const F = {
  display: "'Cormorant Garamond', Georgia, serif",
  mono:    "'Space Mono', monospace",
}

const C = {
  bg:      '#0c0a08',
  card:    '#161210',
  cardHot: '#1c1610',
  border:  '#221a12',
  borderHot:'#c4702a',
  accent:  '#c4702a',
  accentL: '#e8a84a',
  text:    '#e8ddd0',
  mid:     '#7a6858',
  dim:     '#3a2e24',
  green:   '#4a9e6a',
}

// ─── MENU ─────────────────────────────────────────────────────────────────────
const MENU = [
  {
    id:    1,
    name:  'Suero',
    desc:  'The morning after, before it starts',
    price: 60,
    Icon:  () => (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <path d="M10 8h16l-2 14H12L10 8z" stroke="#c4702a" strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
        <path d="M8 8h20" stroke="#c4702a" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M13 22c0 3 1.5 5 5 5s5-2 5-5" stroke="#c4702a" strokeWidth="1.2" fill="none"/>
        <path d="M15 12q3 2 6 0" stroke="#e8a84a" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
        <path d="M14 15q4 3 8 0" stroke="#e8a84a" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
      </svg>
    ),
  },
  {
    id:    2,
    name:  'Suero con Mezcal',
    desc:  'Smoke in the remedy',
    price: 100,
    Icon:  () => (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <path d="M10 8h16l-2 14H12L10 8z" stroke="#c4702a" strokeWidth="1.4" strokeLinejoin="round" fill="none"/>
        <path d="M8 8h20" stroke="#c4702a" strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M13 22c0 3 1.5 5 5 5s5-2 5-5" stroke="#c4702a" strokeWidth="1.2" fill="none"/>
        {/* smoke wisps */}
        <path d="M18 5 Q19 3 18 1" stroke="#e8a84a" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.7"/>
        <path d="M21 6 Q22.5 4 21 2" stroke="#e8a84a" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.5"/>
        <path d="M15 6 Q13.5 4 15 2" stroke="#e8a84a" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.4"/>
      </svg>
    ),
  },
  {
    id:    3,
    name:  'Cerveza',
    desc:  'Fría. Siempre fría.',
    price: 50,
    Icon:  () => (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect x="11" y="9" width="14" height="20" rx="3" stroke="#c4702a" strokeWidth="1.4" fill="none"/>
        <path d="M25 13h3a2 2 0 010 4h-3" stroke="#c4702a" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
        <path d="M13 9V7" stroke="#c4702a" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M18 9V7" stroke="#c4702a" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M23 9V7" stroke="#c4702a" strokeWidth="1.3" strokeLinecap="round"/>
        {/* foam */}
        <path d="M11 15h14" stroke="#e8a84a" strokeWidth="0.8" opacity="0.5"/>
      </svg>
    ),
  },
  {
    id:    4,
    name:  'Michelada',
    desc:  'Limón, sal, chamoy, fuego',
    price: 80,
    Icon:  () => (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
        <rect x="11" y="9" width="14" height="20" rx="3" stroke="#c4702a" strokeWidth="1.4" fill="none"/>
        <path d="M25 13h3a2 2 0 010 4h-3" stroke="#c4702a" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
        <path d="M13 9V7" stroke="#c4702a" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M18 9V7" stroke="#c4702a" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M23 9V7" stroke="#c4702a" strokeWidth="1.3" strokeLinecap="round"/>
        {/* chili / spice line */}
        <path d="M14 20 Q18 17 22 20" stroke="#c4702a" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.8"/>
        <circle cx="18" cy="23" r="1.5" fill="#c4702a" opacity="0.4"/>
      </svg>
    ),
  },
]

function fmt(n) { return `$${n}` }

// ─── NOISE TEXTURE (CSS data URI) ─────────────────────────────────────────────
// Subtle grain overlay — makes the card feel tactile, not digital-flat
const noiseStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
  backgroundSize: '180px',
}

// ─── DRINK CARD ────────────────────────────────────────────────────────────────
function DrinkCard({ item, qty, onAdd, onSub }) {
  const hot = qty > 0

  return (
    <div style={{
      background: hot ? C.cardHot : C.card,
      border: `1px solid ${hot ? C.borderHot : C.border}`,
      borderRadius: '20px',
      padding: '1.4rem 1.2rem 1.1rem',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      minHeight: '200px',
      boxShadow: hot
        ? `0 0 0 1px ${C.accent}44, inset 0 0 40px rgba(196,112,42,0.06)`
        : 'none',
      transition: 'all 0.2s ease',
      position: 'relative',
      overflow: 'hidden',
      ...noiseStyle,
    }}>
      {/* Icon */}
      <div style={{ marginBottom: '0.8rem' }}>
        <item.Icon />
      </div>

      {/* Name */}
      <div style={{
        fontFamily: F.display,
        fontSize: '1.25rem',
        fontWeight: '600',
        color: C.text,
        lineHeight: 1.15,
        marginBottom: '0.3rem',
        letterSpacing: '0.01em',
      }}>
        {item.name}
      </div>

      {/* Description */}
      <div style={{
        fontFamily: F.display,
        fontStyle: 'italic',
        fontSize: '0.78rem',
        color: C.mid,
        lineHeight: 1.4,
        marginBottom: '1rem',
        flex: 1,
      }}>
        {item.desc}
      </div>

      {/* Price + control */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: F.mono,
          fontSize: '1rem',
          fontWeight: '700',
          color: hot ? C.accentL : C.accentL,
          letterSpacing: '-0.02em',
        }}>
          {fmt(item.price)}
        </span>

        {qty === 0 ? (
          <button
            onClick={() => onAdd(item.id)}
            style={{
              background: 'transparent',
              border: `1px solid ${C.accent}`,
              borderRadius: '99px',
              color: C.accent,
              fontFamily: F.mono,
              fontSize: '0.75rem',
              fontWeight: '700',
              padding: '0.35rem 0.85rem',
              cursor: 'pointer',
              letterSpacing: '0.04em',
              transition: 'all 0.15s',
            }}
          >
            ADD
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              onClick={() => onSub(item.id)}
              style={{
                width: '28px', height: '28px',
                borderRadius: '50%',
                background: 'transparent',
                border: `1px solid ${C.dim}`,
                color: C.mid,
                cursor: 'pointer',
                fontSize: '1rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: F.mono,
              }}
            >−</button>
            <span style={{
              fontFamily: F.mono,
              color: C.accentL,
              fontWeight: '700',
              fontSize: '0.9rem',
              minWidth: '14px',
              textAlign: 'center',
            }}>
              {qty}
            </span>
            <button
              onClick={() => onAdd(item.id)}
              style={{
                width: '28px', height: '28px',
                borderRadius: '50%',
                background: C.accent,
                border: 'none',
                color: '#000',
                cursor: 'pointer',
                fontSize: '1rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: F.mono,
              }}
            >+</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CONFIRMED ────────────────────────────────────────────────────────────────
function Confirmed({ items, onReset }) {
  const id = String(Math.floor(Math.random() * 90 + 10))

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      textAlign: 'center',
      fontFamily: F.display,
    }}>
      <div style={{
        fontFamily: F.mono,
        fontSize: '0.7rem',
        color: C.mid,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        marginBottom: '0.75rem',
      }}>
        Order placed
      </div>

      <div style={{
        fontFamily: F.mono,
        fontSize: '4rem',
        fontWeight: '700',
        color: C.accentL,
        lineHeight: 1,
        marginBottom: '0.5rem',
        letterSpacing: '-0.03em',
      }}>
        #{id}
      </div>

      <div style={{
        fontFamily: F.display,
        fontStyle: 'italic',
        color: C.mid,
        fontSize: '1rem',
        marginBottom: '2.5rem',
        lineHeight: 1.5,
      }}>
        {items.map(i => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(' · ')}
      </div>

      <button
        onClick={onReset}
        style={{
          background: 'transparent',
          border: `1px solid ${C.accent}`,
          borderRadius: '99px',
          color: C.accent,
          fontFamily: F.mono,
          fontSize: '0.75rem',
          fontWeight: '700',
          letterSpacing: '0.08em',
          padding: '0.65rem 1.8rem',
          cursor: 'pointer',
        }}
      >
        NEW ORDER
      </button>
    </div>
  )
}

// ─── STAFF VIEW ────────────────────────────────────────────────────────────────
function StaffView({ orders, onAdvance, onBack }) {
  const active  = orders.filter(o => o.status !== 'done')
  const done    = orders.filter(o => o.status === 'done')
  const revenue = done.reduce((s, o) => s + o.total, 0)
  const next    = { pending: 'making', making: 'done' }
  const label   = { pending: 'Making →', making: 'Done ✓' }
  const col     = { pending: C.accent, making: '#6ab0d4', done: C.dim }

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      color: C.text,
      fontFamily: F.display,
      padding: '1.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontFamily: F.display, fontWeight: '600', fontSize: '1.3rem', color: C.text }}>
            Bar — Staff
          </div>
          <div style={{ fontFamily: F.mono, fontSize: '0.7rem', color: C.mid, marginTop: '0.2rem' }}>
            {active.length} active · ${revenue} collected
          </div>
        </div>
        <button onClick={onBack} style={{
          background: 'transparent',
          border: `1px solid ${C.border}`,
          borderRadius: '8px',
          color: C.mid,
          fontFamily: F.mono,
          fontSize: '0.7rem',
          padding: '0.4rem 0.8rem',
          cursor: 'pointer',
        }}>
          ← Menu
        </button>
      </div>

      {active.length === 0 && (
        <div style={{ textAlign: 'center', color: C.dim, padding: '4rem 0', fontFamily: F.display, fontStyle: 'italic', fontSize: '1rem' }}>
          Caught up.
        </div>
      )}

      {active.map(o => (
        <div key={o.id} style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderLeft: `2px solid ${col[o.status]}`,
          borderRadius: '12px',
          padding: '1rem 1.1rem',
          marginBottom: '0.6rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: F.mono, color: col[o.status], fontSize: '0.85rem', fontWeight: '700', marginBottom: '0.2rem' }}>
              #{o.id}
            </div>
            <div style={{ fontFamily: F.display, color: C.text, fontSize: '0.9rem', fontStyle: 'italic' }}>
              {o.items.map(i => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(' · ')}
            </div>
          </div>
          <button
            onClick={() => onAdvance(o.id)}
            style={{
              background: 'transparent',
              border: `1px solid ${col[o.status]}`,
              color: col[o.status],
              borderRadius: '8px',
              padding: '0.4rem 0.8rem',
              fontFamily: F.mono,
              fontSize: '0.7rem',
              fontWeight: '700',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {label[o.status]}
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── PIN GATE ─────────────────────────────────────────────────────────────────
function PinGate({ onUnlock, onBack }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)

  const attempt = () => {
    if (pin === '7777') { onUnlock() }
    else { setErr(true); setPin('') }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: F.display,
      padding: '1rem',
    }}>
      <div style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: '20px',
        padding: '2.5rem 2rem',
        maxWidth: '300px',
        width: '100%',
        textAlign: 'center',
      }}>
        <div style={{ fontFamily: F.display, fontSize: '1.4rem', fontWeight: '600', color: C.text, marginBottom: '0.3rem' }}>
          Staff
        </div>
        <div style={{ fontFamily: F.display, fontStyle: 'italic', color: C.mid, fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Enter PIN to continue
        </div>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={e => { setPin(e.target.value); setErr(false) }}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          style={{
            width: '100%',
            background: '#1a1610',
            border: `1px solid ${err ? '#8b2020' : C.border}`,
            borderRadius: '10px',
            color: C.text,
            fontFamily: F.mono,
            padding: '0.85rem',
            fontSize: '1.4rem',
            textAlign: 'center',
            letterSpacing: '0.4em',
            outline: 'none',
            boxSizing: 'border-box',
            marginBottom: err ? '0.4rem' : '0.8rem',
          }}
        />
        {err && (
          <div style={{ fontFamily: F.display, fontStyle: 'italic', color: '#8b4040', fontSize: '0.8rem', marginBottom: '0.6rem' }}>
            Incorrect
          </div>
        )}
        <button
          onClick={attempt}
          style={{
            width: '100%',
            background: C.accent,
            color: '#000',
            border: 'none',
            borderRadius: '10px',
            padding: '0.85rem',
            fontFamily: F.mono,
            fontWeight: '700',
            fontSize: '0.82rem',
            letterSpacing: '0.08em',
            cursor: 'pointer',
            marginBottom: '0.5rem',
          }}
        >
          UNLOCK
        </button>
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: C.dim,
            fontFamily: F.display,
            fontStyle: 'italic',
            fontSize: '0.82rem',
            cursor: 'pointer',
          }}
        >
          back
        </button>
      </div>
    </div>
  )
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
export default function SimpleBar() {
  const [cart,    setCart]   = useState({})
  const [orders,  setOrders] = useState([])
  const [screen,  setScreen] = useState('menu')
  const [lastOrder, setLast] = useState(null)

  const cartItems = MENU.filter(m => (cart[m.id] || 0) > 0).map(m => ({ ...m, qty: cart[m.id] }))
  const cartTotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0)
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0)

  const add = id => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }))
  const sub = id => setCart(c => ({ ...c, [id]: Math.max(0, (c[id] || 0) - 1) }))

  const placeOrder = () => {
    const id = Math.floor(Math.random() * 90 + 10)
    const order = { id, items: cartItems, total: cartTotal, status: 'pending' }
    setOrders(prev => [order, ...prev])
    setLast(order)
    setCart({})
    setScreen('confirmed')
  }

  const advance = orderId => setOrders(prev => prev.map(o => {
    if (o.id !== orderId) return o
    const next = { pending: 'making', making: 'done' }
    return { ...o, status: next[o.status] || o.status }
  }))

  if (screen === 'confirmed' && lastOrder) {
    return <Confirmed items={lastOrder.items} onReset={() => setScreen('menu')} />
  }
  if (screen === 'pin') {
    return <PinGate onUnlock={() => setScreen('staff')} onBack={() => setScreen('menu')} />
  }
  if (screen === 'staff') {
    return <StaffView orders={orders} onAdvance={advance} onBack={() => setScreen('menu')} />
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      color: C.text,
      fontFamily: F.display,
      paddingBottom: cartCount > 0 ? '90px' : '2rem',
    }}>

      {/* Header */}
      <div style={{
        padding: '2rem 1.4rem 1.2rem',
      }}>
        <div style={{
          fontFamily: F.display,
          fontSize: '2rem',
          fontWeight: '600',
          color: C.text,
          letterSpacing: '-0.01em',
          lineHeight: 1,
          marginBottom: '0.2rem',
        }}>
          Bar
        </div>
        <div style={{
          fontFamily: F.display,
          fontStyle: 'italic',
          color: C.mid,
          fontSize: '0.9rem',
        }}>
          Tap to order
        </div>
      </div>

      {/* 2×2 Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.7rem',
        padding: '0 1rem',
      }}>
        {MENU.map(item => (
          <DrinkCard
            key={item.id}
            item={item}
            qty={cart[item.id] || 0}
            onAdd={add}
            onSub={sub}
          />
        ))}
      </div>

      {/* Order footer */}
      {cartCount > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          background: '#161210f0',
          borderTop: `1px solid ${C.accent}55`,
          backdropFilter: 'blur(12px)',
          padding: '0.9rem 1.2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.8rem',
          zIndex: 20,
        }}>
          <div style={{
            fontFamily: F.mono,
            fontSize: '0.72rem',
            color: C.accent,
            border: `1px solid ${C.accent}55`,
            borderRadius: '99px',
            padding: '0.2rem 0.6rem',
            flexShrink: 0,
          }}>
            {cartCount}
          </div>
          <div style={{
            fontFamily: F.display,
            fontStyle: 'italic',
            color: C.mid,
            fontSize: '0.85rem',
            flex: 1,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}>
            {cartItems.map(i => i.name).join(', ')}
          </div>
          <div style={{
            fontFamily: F.mono,
            color: C.accentL,
            fontWeight: '700',
            fontSize: '0.9rem',
            flexShrink: 0,
          }}>
            {fmt(cartTotal)}
          </div>
          <button
            onClick={placeOrder}
            style={{
              background: C.accent,
              color: '#000',
              border: 'none',
              borderRadius: '10px',
              padding: '0.65rem 1.1rem',
              fontFamily: F.mono,
              fontWeight: '700',
              fontSize: '0.78rem',
              letterSpacing: '0.06em',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ORDER →
          </button>
        </div>
      )}

      {/* Staff — discreet, bottom corner, hidden when cart is open */}
      {cartCount === 0 && (
        <button
          onClick={() => setScreen('pin')}
          style={{
            position: 'fixed',
            bottom: '1.2rem',
            right: '1.2rem',
            background: 'transparent',
            border: `1px solid ${C.dim}`,
            borderRadius: '99px',
            color: C.dim,
            fontFamily: F.mono,
            fontSize: '0.62rem',
            letterSpacing: '0.08em',
            padding: '0.3rem 0.7rem',
            cursor: 'pointer',
          }}
        >
          STAFF
        </button>
      )}
    </div>
  )
}
