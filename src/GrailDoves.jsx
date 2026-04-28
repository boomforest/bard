import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from './supabase'
import { grailStore } from './grailStore'
import { emojiFor } from './featuredDrinks'

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const DOVE_TO_MXN = 1   // 1 Dove = 1 MXN (simple, intuitive)
const LEGACY_EVENT_SLUG = 'nonlinear-2026'   // Fallback when /grail/doves is hit without a slug

const LOAD_PRESETS = [100, 200, 500, 1000]   // Dove preset amounts

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg:        '#080808',
  surface:   '#111',
  card:      '#141414',
  border:    '#1c1c1c',
  gold:      '#c8922a',
  goldLight: '#e8b84b',
  goldDim:   '#6b4a14',
  green:     '#22c55e',
  greenDim:  '#14532d',
  red:       '#ef4444',
  blue:      '#3b82f6',
  text:      '#e8e0d0',
  textMid:   '#9a8878',
  textDim:   '#3a3028',
}

function fmt(n) { return `$${Math.round(n).toLocaleString()}` }

// ─── SCREENS ──────────────────────────────────────────────────────────────────
// 'home'   → balance + load / spend options
// 'load'   → pick how many Doves to pre-authorize
// 'menu'   → browse menu + add to cart
// 'cart'   → confirm order + spend Doves
// 'confirm'→ order placed confirmation

// ─── BALANCE HEADER ───────────────────────────────────────────────────────────
function BalanceHeader({ balance, onLoad }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, #0d0800, #1a1000)`,
      borderBottom: `1px solid ${C.goldDim}`,
      padding: '1.2rem 1.4rem',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontSize: '0.65rem',
            color: C.goldDim,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            fontWeight: '700',
            marginBottom: '0.15rem',
          }}>
            🕊 Dove Balance
          </div>
          <div style={{
            color: balance > 0 ? C.goldLight : C.textMid,
            fontSize: '2rem',
            fontWeight: '900',
            lineHeight: 1,
          }}>
            {balance}
            <span style={{ fontSize: '0.9rem', color: C.goldDim, fontWeight: '600', marginLeft: '0.3rem' }}>
              doves
            </span>
          </div>
          <div style={{ color: C.textMid, fontSize: '0.72rem', marginTop: '0.15rem' }}>
            ≈ {fmt(balance * DOVE_TO_MXN)} MXN available
          </div>
        </div>
        <button
          onClick={onLoad}
          style={{
            background: C.gold,
            color: '#000',
            border: 'none',
            borderRadius: '10px',
            padding: '0.6rem 1.1rem',
            fontWeight: '800',
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          + Load Doves
        </button>
      </div>
    </div>
  )
}

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
function HomeScreen({ balance, transactions, onLoad, onMenu }) {
  const totalSpent = transactions.reduce((s, t) => s + t.doves, 0)

  return (
    <div style={{ padding: '1.2rem' }}>
      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem', marginBottom: '1.5rem' }}>
        <button
          onClick={onMenu}
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: '14px',
            padding: '1.2rem 1rem',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>🍹</div>
          <div style={{ color: C.text, fontWeight: '700', fontSize: '0.9rem' }}>Order a Drink</div>
          <div style={{ color: C.textMid, fontSize: '0.75rem', marginTop: '0.1rem' }}>Pay with Doves</div>
        </button>
        <button
          onClick={onLoad}
          style={{
            background: '#1a1000',
            border: `1px solid ${C.goldDim}`,
            borderRadius: '14px',
            padding: '1.2rem 1rem',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>🕊</div>
          <div style={{ color: C.goldLight, fontWeight: '700', fontSize: '0.9rem' }}>Load Doves</div>
          <div style={{ color: C.textMid, fontSize: '0.75rem', marginTop: '0.1rem' }}>Pre-auth your card</div>
        </button>
      </div>

      {/* How it works — shown when balance is 0 */}
      {balance === 0 && (
        <div style={{
          background: '#0d0d0d',
          border: `1px solid ${C.border}`,
          borderRadius: '12px',
          padding: '1.1rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{ color: C.goldLight, fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.7rem' }}>
            How Doves work
          </div>
          {[
            ['🕊', 'Load Doves', 'We hold your card — nothing is charged yet'],
            ['🍹', 'Order drinks', 'Spend Doves at the bar'],
            ['✓',  'End of night', 'You\'re charged only what you spent'],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{ display: 'flex', gap: '0.7rem', marginBottom: '0.6rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1rem', flexShrink: 0 }}>{icon}</span>
              <div>
                <div style={{ color: C.text, fontSize: '0.82rem', fontWeight: '600' }}>{title}</div>
                <div style={{ color: C.textMid, fontSize: '0.75rem' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transaction history */}
      {transactions.length > 0 && (
        <div>
          <div style={{
            fontSize: '0.68rem',
            color: C.textMid,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '0.6rem',
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span>Spent tonight</span>
            <span style={{ color: C.goldLight }}>{totalSpent} doves · {fmt(totalSpent)}</span>
          </div>
          {transactions.slice().reverse().map(tx => (
            <div key={tx.id} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.6rem 0',
              borderBottom: `1px solid ${C.border}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.2rem' }}>{tx.emoji}</span>
                <div>
                  <div style={{ color: C.text, fontSize: '0.85rem' }}>{tx.item}</div>
                  <div style={{ color: C.textMid, fontSize: '0.7rem' }}>
                    {new Date(tx.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: C.red, fontWeight: '700', fontSize: '0.85rem' }}>−{tx.doves} 🕊</div>
                <div style={{ color: C.textDim, fontSize: '0.7rem' }}>{fmt(tx.mxn)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── LOAD SCREEN ──────────────────────────────────────────────────────────────
function LoadScreen({ onLoad, onBack }) {
  const [amount,   setAmount]   = useState(200)
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)

  const handleLoad = async () => {
    setLoading(true)
    // TODO: create Stripe payment_intent with capture_method: 'manual' for pre-auth
    // const { clientSecret } = await fetch('/.netlify/functions/create-dove-intent', {
    //   method: 'POST', body: JSON.stringify({ amount_mxn: amount, event_id: EVENT_ID })
    // }).then(r => r.json())
    await new Promise(r => setTimeout(r, 800))  // simulated delay
    setLoading(false)
    setDone(true)
    setTimeout(() => onLoad(amount), 1200)
  }

  if (done) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        padding: '2rem',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.7rem' }}>🕊</div>
        <div style={{ color: C.green, fontSize: '1.3rem', fontWeight: '800', marginBottom: '0.3rem' }}>
          {amount} Doves loaded
        </div>
        <div style={{ color: C.textMid, fontSize: '0.85rem' }}>
          Your card is pre-authorized for {fmt(amount)}.<br />
          You'll only be charged what you spend.
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <button
        onClick={onBack}
        style={{ background: 'transparent', border: 'none', color: C.textMid, cursor: 'pointer', marginBottom: '1.2rem', padding: 0, fontSize: '0.85rem' }}
      >
        ← Back
      </button>

      <div style={{ color: C.goldLight, fontWeight: '800', fontSize: '1.1rem', marginBottom: '0.3rem' }}>
        Load Doves
      </div>
      <div style={{ color: C.textMid, fontSize: '0.82rem', marginBottom: '1.5rem' }}>
        We pre-authorize your card. You're charged only what you spend — 24h after the event.
      </div>

      {/* Preset buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
        {LOAD_PRESETS.map(p => (
          <button
            key={p}
            onClick={() => setAmount(p)}
            style={{
              padding: '0.7rem 0.3rem',
              borderRadius: '10px',
              border: `1px solid ${amount === p ? C.gold : C.border}`,
              background: amount === p ? '#1a1000' : C.card,
              color: amount === p ? C.goldLight : C.textMid,
              fontWeight: amount === p ? '700' : '500',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            {p} 🕊
          </button>
        ))}
      </div>

      {/* Custom amount */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.68rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.4rem' }}>
          Or enter custom amount
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="number"
            min={50}
            max={5000}
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            style={{
              flex: 1,
              background: '#1a1a1a',
              border: `1px solid ${C.border}`,
              borderRadius: '8px',
              color: C.text,
              padding: '0.7rem',
              fontSize: '1rem',
              outline: 'none',
            }}
          />
          <span style={{ color: C.textMid, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>🕊 = {fmt(amount)}</span>
        </div>
      </div>

      {/* Summary */}
      <div style={{
        background: '#0d0d0d',
        border: `1px solid ${C.border}`,
        borderRadius: '10px',
        padding: '0.9rem 1rem',
        marginBottom: '1.5rem',
        fontSize: '0.82rem',
        color: C.textMid,
      }}>
        Card pre-authorized for <strong style={{ color: C.text }}>{fmt(amount)}</strong>.
        {' '}Unspent Doves evaporate — nothing extra is charged.
      </div>

      <button
        onClick={handleLoad}
        disabled={loading || amount < 1}
        style={{
          width: '100%',
          background: loading ? '#333' : C.gold,
          color: '#000',
          border: 'none',
          borderRadius: '12px',
          padding: '1rem',
          fontWeight: '800',
          fontSize: '1rem',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Authorizing card...' : `Pre-authorize ${fmt(amount)}`}
      </button>
    </div>
  )
}

// ─── MENU SCREEN ──────────────────────────────────────────────────────────────
function MenuScreen({ menu, cats, balance, cart, onAddToCart, onRemoveFromCart, onGoToCart, onBack }) {
  const [cat, setCat] = useState('all')
  const visible   = cat === 'all' ? menu : menu.filter(m => m.cat === cat)
  const cartCount = cart.reduce((s, c) => s + c.qty, 0)
  const cartTotal = cart.reduce((s, c) => s + c.item.doves * c.qty, 0)
  const canAfford = (item) => balance >= item.doves

  return (
    <div style={{ paddingBottom: cartCount > 0 ? '90px' : '1rem' }}>
      {/* Category tabs */}
      <div style={{
        display: 'flex',
        gap: '0.4rem',
        padding: '0.8rem 1rem',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        position: 'sticky',
        top: 0,
        background: C.bg,
        zIndex: 5,
        borderBottom: `1px solid ${C.border}`,
      }}>
        {cats.map(c => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            style={{
              flexShrink: 0,
              padding: '0.4rem 0.9rem',
              borderRadius: '99px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: cat === c.key ? '700' : '500',
              background: cat === c.key ? C.gold : '#1c1c1c',
              color: cat === c.key ? '#000' : C.textMid,
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Menu items */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))',
        gap: '0.6rem',
        padding: '0.8rem 1rem',
      }}>
        {visible.map(item => {
          const inCart  = cart.find(c => c.item.id === item.id)
          const afford  = canAfford(item)
          return (
            <button
              key={item.id}
              onClick={() => afford ? onAddToCart(item) : null}
              style={{
                background: C.card,
                border: `1px solid ${inCart ? C.goldDim : afford ? C.border : '#1a1a1a'}`,
                borderRadius: '12px',
                padding: '0.9rem 0.8rem',
                cursor: afford ? 'pointer' : 'not-allowed',
                textAlign: 'left',
                position: 'relative',
                opacity: afford ? 1 : 0.45,
                outline: 'none',
              }}
            >
              <div style={{ fontSize: '1.8rem', marginBottom: '0.35rem' }}>{item.emoji}</div>
              <div style={{ color: C.text, fontWeight: '600', fontSize: '0.85rem', marginBottom: '0.15rem' }}>
                {item.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ color: C.goldLight, fontWeight: '700', fontSize: '0.88rem' }}>
                  {item.doves}
                </span>
                <span style={{ color: C.goldDim, fontSize: '0.72rem' }}>🕊</span>
              </div>
              {!afford && (
                <div style={{ fontSize: '0.62rem', color: C.red, marginTop: '0.1rem' }}>Not enough doves</div>
              )}
              {inCart && (
                <div style={{
                  position: 'absolute', top: '0.4rem', right: '0.4rem',
                  background: C.gold, color: '#000',
                  borderRadius: '99px', width: '18px', height: '18px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.65rem', fontWeight: '800',
                }}>
                  {inCart.qty}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Cart footer */}
      {cartCount > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          background: '#141414',
          borderTop: `1px solid ${C.goldDim}`,
          padding: '0.8rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{
              background: C.gold, color: '#000',
              borderRadius: '99px', padding: '0.15rem 0.6rem',
              fontWeight: '800', fontSize: '0.82rem',
            }}>
              {cartCount}
            </div>
            <span style={{ color: C.textMid, fontSize: '0.85rem' }}>items</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <span style={{ color: C.goldLight, fontWeight: '700' }}>{cartTotal} 🕊</span>
            <button
              onClick={onGoToCart}
              style={{
                background: C.gold, color: '#000', border: 'none',
                borderRadius: '8px', padding: '0.55rem 1rem',
                fontWeight: '800', fontSize: '0.85rem', cursor: 'pointer',
              }}
            >
              Review Order →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CART SCREEN ──────────────────────────────────────────────────────────────
function CartScreen({ cart, balance, onAddToCart, onRemoveFromCart, onConfirm, onBack }) {
  const total   = cart.reduce((s, c) => s + c.item.doves * c.qty, 0)
  const canPay  = balance >= total && cart.length > 0

  return (
    <div style={{ padding: '1.2rem' }}>
      <button
        onClick={onBack}
        style={{ background: 'transparent', border: 'none', color: C.textMid, cursor: 'pointer', marginBottom: '1rem', padding: 0, fontSize: '0.85rem' }}
      >
        ← Keep shopping
      </button>

      <div style={{ color: C.goldLight, fontWeight: '800', fontSize: '1rem', marginBottom: '1rem' }}>
        Your Order
      </div>

      {cart.map(({ item, qty }) => (
        <div key={item.id} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.7rem 0', borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.3rem' }}>{item.emoji}</span>
            <div>
              <div style={{ color: C.text, fontSize: '0.9rem' }}>{item.name}</div>
              <div style={{ color: C.textMid, fontSize: '0.72rem' }}>{item.doves} 🕊 each</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
            <button
              onClick={() => onRemoveFromCart(item.id)}
              style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#222', border: 'none', color: C.text, cursor: 'pointer', fontSize: '0.9rem' }}
            >−</button>
            <span style={{ color: C.text, fontWeight: '700', minWidth: '14px', textAlign: 'center' }}>{qty}</span>
            <button
              onClick={() => onAddToCart(item)}
              style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#222', border: 'none', color: C.text, cursor: 'pointer', fontSize: '0.9rem' }}
            >+</button>
            <span style={{ color: C.goldLight, fontWeight: '700', minWidth: '55px', textAlign: 'right' }}>
              {item.doves * qty} 🕊
            </span>
          </div>
        </div>
      ))}

      {/* Total + balance */}
      <div style={{
        background: '#0d0d0d',
        border: `1px solid ${C.border}`,
        borderRadius: '10px',
        padding: '0.9rem 1rem',
        margin: '1.2rem 0',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ color: C.textMid, fontSize: '0.85rem' }}>Order total</span>
          <span style={{ color: C.text, fontWeight: '700' }}>{total} 🕊</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ color: C.textMid, fontSize: '0.85rem' }}>Your balance</span>
          <span style={{ color: C.goldLight, fontWeight: '700' }}>{balance} 🕊</span>
        </div>
        <div style={{ height: '1px', background: C.border, margin: '0.5rem 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: C.textMid, fontSize: '0.85rem' }}>After order</span>
          <span style={{
            fontWeight: '700',
            color: canPay ? C.green : C.red,
          }}>
            {balance - total} 🕊
          </span>
        </div>
      </div>

      {!canPay && total > balance && (
        <div style={{ color: C.red, fontSize: '0.8rem', textAlign: 'center', marginBottom: '0.8rem' }}>
          Not enough Doves — load {total - balance} more to place this order
        </div>
      )}

      <button
        disabled={!canPay}
        onClick={onConfirm}
        style={{
          width: '100%',
          background: canPay ? C.gold : '#333',
          color: canPay ? '#000' : C.textDim,
          border: 'none',
          borderRadius: '12px',
          padding: '1rem',
          fontWeight: '800',
          fontSize: '1rem',
          cursor: canPay ? 'pointer' : 'not-allowed',
        }}
      >
        Spend {total} Doves →
      </button>
    </div>
  )
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
export default function GrailDoves() {
  const { slug }        = useParams()
  const eventSlug       = slug || LEGACY_EVENT_SLUG
  const [event,        setEvent]        = useState(null)       // { id, slug, name }
  const [menu,         setMenu]         = useState([])         // bar_menu_items mapped to UI shape
  const [menuLoading,  setMenuLoading]  = useState(true)
  const [screen,       setScreen]       = useState('home')     // home | load | menu | cart | confirm
  const [balance,      setBalance]      = useState(0)          // current dove balance
  const [cart,         setCart]         = useState([])
  const [transactions, setTransactions] = useState([])
  const [lastOrderId,  setLastOrderId]  = useState(null)

  // Fetch the event + bar menu items from Supabase. The promoter sets the
  // menu in StepBar (GrailSetup); we render their authoritative version.
  // Featured drinks (matched by name) get an emoji card; custom items
  // render as plain text.
  useEffect(() => {
    let cancelled = false
    async function load() {
      setMenuLoading(true)
      const { data: ev } = await supabase
        .from('events')
        .select('id, slug, name')
        .eq('slug', eventSlug)
        .maybeSingle()
      if (cancelled) return
      if (!ev) { setMenuLoading(false); return }
      setEvent(ev)
      const { data: rows } = await supabase
        .from('bar_menu_items')
        .select('id, name, price_cents, category, description, sort_order, active')
        .eq('event_id', ev.id)
        .eq('active', true)
        .order('sort_order', { ascending: true })
      if (cancelled) return
      const mapped = (rows || []).map(r => ({
        id:    r.id,
        name:  r.name,
        doves: Math.round((r.price_cents || 0) / 100),
        cat:   (r.category || 'drinks').toLowerCase(),
        emoji: emojiFor(r.name),
        desc:  r.description || '',
      }))
      setMenu(mapped)
      setMenuLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [eventSlug])

  // Build category tabs dynamically from the items the promoter actually configured.
  const cats = [
    { key: 'all', label: 'All' },
    ...Array.from(new Set(menu.map(m => m.cat))).map(c => ({
      key: c,
      label: c.charAt(0).toUpperCase() + c.slice(1),
    })),
  ]

  const addToCart = (item) => setCart(prev => {
    const existing = prev.find(c => c.item.id === item.id)
    if (existing) return prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c)
    return [...prev, { item, qty: 1 }]
  })

  const removeFromCart = (itemId) => setCart(prev => {
    const existing = prev.find(c => c.item.id === itemId)
    if (!existing) return prev
    if (existing.qty === 1) return prev.filter(c => c.item.id !== itemId)
    return prev.map(c => c.item.id === itemId ? { ...c, qty: c.qty - 1 } : c)
  })

  const handleLoadDoves = (amount) => {
    setBalance(b => b + amount)
    setScreen('home')
  }

  const handleConfirmOrder = () => {
    const total = cart.reduce((s, c) => s + c.item.doves * c.qty, 0)
    const orderId = `D${Date.now().toString().slice(-5)}`

    // Create transactions for each item
    const newTxs = cart.flatMap(({ item, qty }) =>
      Array.from({ length: qty }, (_, i) => ({
        id:        `${orderId}-${item.id}-${i}`,
        userId:    'guest',
        userName:  'Guest',
        item:      item.name,
        emoji:     item.emoji,
        doves:     item.doves,
        mxn:       item.doves * DOVE_TO_MXN,
        timestamp: new Date().toISOString(),
        eventId:   event?.id || eventSlug,
      }))
    )

    // Update local balance
    setBalance(b => b - total)
    setTransactions(prev => [...prev, ...newTxs])
    setCart([])
    setLastOrderId(orderId)

    // ── KEY: push to shared accounting store ──────────────────────────────────
    newTxs.forEach(tx => grailStore.addDoveTransaction(tx))
    // TODO: also insert to Supabase grail_dove_transactions
    //   supabase.from('grail_dove_transactions').insert(newTxs)

    setScreen('confirm')
  }

  // Confirmation screen
  if (screen === 'confirm') {
    const lastTxs  = transactions.slice(-cart.length - 50) // recent
    const orderTxs = lastTxs.filter(t => t.id.startsWith(lastOrderId || ''))
    const spent    = orderTxs.reduce((s, t) => s + t.doves, 0)

    return (
      <div style={{
        minHeight: '100vh', background: C.bg, fontFamily: 'system-ui, sans-serif',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '2rem', textAlign: 'center',
      }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '0.8rem' }}>🕊</div>
        <div style={{ color: C.green, fontSize: '1.4rem', fontWeight: '800', marginBottom: '0.3rem' }}>
          Order placed
        </div>
        <div style={{ color: C.textMid, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          {spent} Doves spent · {fmt(spent)} charged to your card later
        </div>
        <div style={{ color: C.textMid, fontSize: '0.8rem', marginBottom: '2rem' }}>
          Remaining balance: <strong style={{ color: C.goldLight }}>{balance} 🕊</strong>
        </div>
        <div style={{ display: 'flex', gap: '0.7rem' }}>
          <button
            onClick={() => setScreen('menu')}
            style={{
              background: C.gold, color: '#000', border: 'none',
              borderRadius: '10px', padding: '0.8rem 1.3rem',
              fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer',
            }}
          >
            Order More
          </button>
          <button
            onClick={() => setScreen('home')}
            style={{
              background: 'transparent', color: C.textMid,
              border: `1px solid ${C.border}`, borderRadius: '10px',
              padding: '0.8rem 1.3rem', fontSize: '0.9rem', cursor: 'pointer',
            }}
          >
            My Balance
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      color: C.text,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Balance header — always visible */}
      <BalanceHeader balance={balance} onLoad={() => setScreen('load')} />

      {/* Navigation tabs */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${C.border}`,
        background: C.surface,
      }}>
        {[
          { key: 'home', label: '🏠 Home' },
          { key: 'menu', label: '🍹 Menu' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setScreen(key)}
            style={{
              flex: 1,
              padding: '0.7rem',
              background: 'transparent',
              border: 'none',
              borderBottom: screen === key ? `2px solid ${C.gold}` : '2px solid transparent',
              color: screen === key ? C.goldLight : C.textMid,
              fontWeight: screen === key ? '700' : '400',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Screen content */}
      {screen === 'home' && (
        <HomeScreen
          balance={balance}
          transactions={transactions}
          onLoad={() => setScreen('load')}
          onMenu={() => setScreen('menu')}
        />
      )}
      {screen === 'load' && (
        <LoadScreen onLoad={handleLoadDoves} onBack={() => setScreen('home')} />
      )}
      {screen === 'menu' && (
        <MenuScreen
          menu={menu}
          cats={cats}
          balance={balance}
          cart={cart}
          onAddToCart={addToCart}
          onRemoveFromCart={removeFromCart}
          onGoToCart={() => setScreen('cart')}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'cart' && (
        <CartScreen
          cart={cart}
          balance={balance}
          onAddToCart={addToCart}
          onRemoveFromCart={removeFromCart}
          onConfirm={handleConfirmOrder}
          onBack={() => setScreen('menu')}
        />
      )}
    </div>
  )
}
