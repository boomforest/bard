import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { imageFor, descFor } from './featuredDrinks'
import { BRAND } from './theme'

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg:       '#080808',
  surface:  '#111',
  card:     '#141414',
  border:   '#1e1e1e',
  gold:     '#c8922a',
  goldLight:'#e8b84b',
  goldDim:  '#6b4a14',
  amber:    '#d97316',
  green:    '#22c55e',
  greenDim: '#14532d',
  red:      '#ef4444',
  blue:     '#3b82f6',
  text:     '#e8e0d0',
  textMid:  '#9a8878',
  textDim:  '#4a4038',
}

// Preserves up to 2 decimal places — without this, 0.10-MXN test prices
// collapse to "$0" in the menu/cart display.
function fmt(n, currency = 'MXN') {
  const num = Number(n) || 0
  const rounded = Number.isInteger(num) ? num : Math.round(num * 100) / 100
  return `$${rounded.toLocaleString()}`
}
function fmtTime(iso) {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}
function genOrderId() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  return letters[Math.floor(Math.random() * letters.length)] + Math.floor(Math.random() * 9 + 1)
}

// ─── LOADING / ERROR SCREENS ──────────────────────────────────────────────────
function Centered({ children }) {
  return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif', padding: '2rem',
    }}>
      {children}
    </div>
  )
}

// ─── CUSTOMER VIEW ────────────────────────────────────────────────────────────
function CustomerView({ event, menu, onOrderPlaced }) {
  const categories = ['all', ...new Set(menu.map(i => i.category))]
  const [cat,       setCat]       = useState('all')
  const [cart,      setCart]      = useState([])
  const [cartOpen,  setCartOpen]  = useState(false)
  // Persist the customer's active order so refresh doesn't lose it AND
  // status changes from staff (pending → making → ready → done) propagate
  // live via realtime subscription. Cleared from localStorage when staff
  // marks the order done.
  const [currentOrder, setCurrentOrder] = useState(null)
  const [name,      setName]      = useState('')
  const [showName,  setShowName]  = useState(false)
  const [placing,   setPlacing]   = useState(false)
  const [payErr,    setPayErr]    = useState('')

  const orderKey = `bar-last-order-${event.id}`

  // Restore on mount: read last order id from localStorage, fetch from DB
  useEffect(() => {
    let cancelled = false
    const stored = typeof window !== 'undefined' ? localStorage.getItem(orderKey) : null
    if (!stored) return
    async function check() {
      const { data } = await supabase
        .from('bar_orders')
        .select('*')
        .eq('id', stored)
        .maybeSingle()
      if (cancelled) return
      // If the order is gone or already done/canceled, clear and let the
      // customer see the menu fresh.
      if (!data || data.status === 'done' || data.status === 'canceled') {
        localStorage.removeItem(orderKey)
        return
      }
      setCurrentOrder(data)
      if (data.customer_name && !name) setName(data.customer_name)
    }
    check()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id])

  // Realtime: while a current order exists, listen for status changes so
  // the customer sees "Making → Ready" without refreshing.
  useEffect(() => {
    if (!currentOrder?.id) return
    const channel = supabase
      .channel(`bar-order-${currentOrder.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'bar_orders', filter: `id=eq.${currentOrder.id}` },
        (payload) => {
          const next = payload.new
          if (next.status === 'done' || next.status === 'canceled') {
            // Auto-dismiss when fully resolved
            localStorage.removeItem(orderKey)
            setCurrentOrder(null)
          } else {
            setCurrentOrder(next)
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrder?.id])

  const stashOrder = (order) => {
    setCurrentOrder(order)
    try { localStorage.setItem(orderKey, order.id) } catch {/* quota */}
  }

  const dismissOrder = () => {
    localStorage.removeItem(orderKey)
    setCurrentOrder(null)
  }

  // Manual refresh — fallback for when realtime doesn't fire (flaky venue
  // wifi, backgrounded tab, websocket dropped). Re-pulls the order row.
  const [refreshing, setRefreshing] = useState(false)
  const refreshOrder = async () => {
    if (!currentOrder?.id) return
    setRefreshing(true)
    const { data } = await supabase
      .from('bar_orders')
      .select('*')
      .eq('id', currentOrder.id)
      .maybeSingle()
    if (!data || data.status === 'done' || data.status === 'canceled') {
      localStorage.removeItem(orderKey)
      setCurrentOrder(null)
    } else {
      setCurrentOrder(data)
    }
    setRefreshing(false)
  }

  // Customer confirms pickup — closes the loop on the staff side. Bartender's
  // "Mark Ready" is now their last action; this is what flips the row to done
  // and clears it from the bar queue.
  const [pickingUp, setPickingUp] = useState(false)
  const confirmPickup = async () => {
    if (!currentOrder?.id) return
    setPickingUp(true)
    const { error } = await supabase
      .from('bar_orders')
      .update({ status: 'done' })
      .eq('id', currentOrder.id)
    if (!error) {
      localStorage.removeItem(orderKey)
      setCurrentOrder(null)
    }
    setPickingUp(false)
  }

  // ── Doves balance (optional pre-load) ───────────────────────────────────────
  const tokenKey = `dove-token-${event.id}`
  const [balance, setBalance] = useState(null)        // bar_tabs row or null
  const [loadOpen, setLoadOpen] = useState(false)     // Load Doves sheet open?

  useEffect(() => {
    let cancelled = false
    const stored = typeof window !== 'undefined' ? localStorage.getItem(tokenKey) : null
    if (!stored) return
    async function check() {
      const { data } = await supabase
        .from('bar_tabs')
        .select('*')
        .eq('token', stored)
        .maybeSingle()
      if (cancelled) return
      if (data && data.event_id === event.id && data.status === 'active') {
        setBalance(data)
        if (data.customer_name) setName(data.customer_name)
      } else {
        // stale or refunded — drop the local token
        localStorage.removeItem(tokenKey)
      }
    }
    check()
    return () => { cancelled = true }
  }, [event.id, tokenKey])

  const balanceRemaining = balance ? balance.loaded_cents - balance.spent_cents : 0

  const visible   = cat === 'all' ? menu : menu.filter(m => m.category === cat)
  const cartTotal = cart.reduce((s, c) => s + c.item.price * c.qty, 0)
  const cartCount = cart.reduce((s, c) => s + c.qty, 0)

  const addToCart = item => {
    setCart(prev => {
      const ex = prev.find(c => c.item.id === item.id)
      if (ex) return prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { item, qty: 1 }]
    })
    setCartOpen(true)
  }

  const removeFromCart = itemId => {
    setCart(prev => {
      const ex = prev.find(c => c.item.id === itemId)
      if (!ex) return prev
      if (ex.qty === 1) return prev.filter(c => c.item.id !== itemId)
      return prev.map(c => c.item.id === itemId ? { ...c, qty: c.qty - 1 } : c)
    })
  }

  // Step 1: if Doves balance is loaded, debit it; otherwise open card checkout.
  // Bar is doves-only — customer must load a balance before ordering.
  // No per-drink card checkout (intentionally, to keep the flow fast and
  // refunds simple).
  const submitOrder = async () => {
    if (!name.trim()) {
      setPayErr('Add your name so the bartender can call you.')
      return
    }
    if (!balance || balance.status !== 'active') {
      setPayErr('Load a doves balance first to place an order.')
      setLoadOpen(true)
      return
    }
    setPlacing(true)
    setPayErr('')

    try {
      const cartCents = Math.round(cartTotal * 100)
      if (cartCents > balanceRemaining) {
        throw new Error(`Need $${(cartCents / 100).toFixed(2)}, balance has $${(balanceRemaining / 100).toFixed(2)}. Top up or remove items.`)
      }
      const res = await fetch('/.netlify/functions/spend-doves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token:         balance.token,
          customer_name: name.trim(),
          items:         cart.map(c => ({ menu_item_id: c.item.id, qty: c.qty })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Order failed')
      setBalance(json.balance)
      onOrderPlaced(json.order)
      stashOrder(json.order)
      // Keep `name` populated — buyer already told us their name on the
      // load-doves modal (or first order), no reason to re-ask each round.
      setCart([]); setCartOpen(false); setShowName(false)
    } catch (err) {
      setPayErr(err.message)
    }
    setPlacing(false)
  }

  if (currentOrder) {
    const status = currentOrder.status || 'pending'
    const ready  = status === 'ready'
    const making = status === 'making'
    const items  = Array.isArray(currentOrder.items) ? currentOrder.items : []
    const itemCount = items.reduce((s, i) => s + (i.qty || 0), 0)

    // ─── READY: receipt-style screen modeled on GrailDemo's confirm screen ─
    // Pink eyebrow, neon big number, orange line-item prices — same palette
    // used in the pre-signup demo so the live experience matches the pitch.
    if (ready) {
      return (
        <div style={{
          minHeight: '100vh', background: '#0a0a0a', color: '#e8e0d0',
          fontFamily: 'system-ui, sans-serif',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '2.5rem 2rem',
        }}>
          <div style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}>
            <div style={{
              fontSize: '0.72rem', color: BRAND.pink, textTransform: 'uppercase',
              letterSpacing: '0.18em', fontWeight: '800', marginBottom: '0.4rem',
            }}>
              Ready for pickup
            </div>
            <div style={{
              fontSize: '4rem', fontWeight: '900', color: BRAND.neon, lineHeight: 1,
              letterSpacing: '-0.03em', marginBottom: '0.6rem',
            }}>
              #{currentOrder.id}
            </div>

            {/* Customer name — prominent so the bartender can match it
                when the customer holds up their phone. */}
            {currentOrder.customer_name && (
              <div style={{
                fontSize: '1.4rem', fontWeight: '800', color: '#e8e0d0',
                letterSpacing: '-0.01em', marginBottom: '0.4rem',
              }}>
                {currentOrder.customer_name}
              </div>
            )}
            <div style={{ color: '#8a8098', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              {fmt(currentOrder.total, event.currency)} · {itemCount} item{itemCount !== 1 ? 's' : ''}
            </div>

            {/* Line items — demo card aesthetic */}
            <div style={{
              background: '#111', borderRadius: '12px',
              padding: '0.9rem 1.1rem', marginBottom: '1.5rem',
              textAlign: 'left',
            }}>
              {items.map((i, idx) => (
                <div key={idx} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  fontSize: '0.92rem', color: '#e8e0d0',
                  marginBottom: idx < items.length - 1 ? '0.45rem' : 0,
                }}>
                  <span>{i.qty}× {i.name}</span>
                  <span style={{ color: BRAND.orange, fontWeight: '700' }}>
                    {fmt((i.price || 0) * (i.qty || 0), event.currency)}
                  </span>
                </div>
              ))}
            </div>

            {/* Received button — closes the loop on the staff side */}
            <button
              onClick={confirmPickup}
              disabled={pickingUp}
              style={{
                width: '100%', background: BRAND.gradient, color: '#000',
                border: 'none', borderRadius: '12px',
                padding: '1.1rem', fontSize: '1.05rem', fontWeight: '900',
                cursor: pickingUp ? 'wait' : 'pointer',
                boxShadow: '0 4px 24px rgba(221,34,170,0.35)',
                opacity: pickingUp ? 0.6 : 1, letterSpacing: '0.02em',
                marginBottom: '0.6rem',
              }}
            >
              {pickingUp ? 'Confirming…' : 'Received'}
            </button>

            <button
              onClick={refreshOrder}
              disabled={refreshing}
              style={{
                width: '100%', background: 'transparent', color: '#8a8098',
                border: `1px solid #1e1e2a`, borderRadius: '10px',
                padding: '0.65rem', fontSize: '0.82rem', fontWeight: '600',
                cursor: refreshing ? 'wait' : 'pointer',
              }}
            >
              {refreshing ? 'Refreshing…' : '↻ Refresh status'}
            </button>
          </div>
        </div>
      )
    }

    // ─── PENDING / MAKING: simple status light + copy ────────────────────
    const headline = making ? 'Bartender is making it' : 'Order received'
    const headlineColor = making ? C.blue : C.goldLight
    const subline = making
      ? 'You\'re next in line. Hold tight.'
      : 'The bartender has your order. We\'ll call you when it\'s ready.'

    return (
      <div style={{
        minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '2rem',
        textAlign: 'center', fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
          {making ? '🔨' : '🌅'}
        </div>
        <div style={{ color: headlineColor, fontSize: '1.7rem', fontWeight: '900', marginBottom: '0.3rem', letterSpacing: '-0.02em' }}>
          {headline}
        </div>
        <div style={{ color: C.text, fontSize: '1.05rem', fontWeight: '700', marginBottom: '0.4rem' }}>
          Order #{currentOrder.id}
        </div>
        <div style={{ color: C.textMid, fontSize: '0.92rem', marginBottom: '2rem', maxWidth: '320px' }}>
          {subline}
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            style={{
              background: 'transparent', color: C.text,
              border: `1px solid ${C.border}`, borderRadius: '10px',
              padding: '0.7rem 1.4rem', fontSize: '0.85rem', fontWeight: '700',
              cursor: refreshing ? 'wait' : 'pointer', opacity: refreshing ? 0.6 : 1,
            }}
            onClick={refreshOrder}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : '↻ Refresh status'}
          </button>
          <button
            style={{ background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '0.7rem 1.4rem', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}
            onClick={dismissOrder}
          >
            Order again
          </button>
        </div>
      </div>
    )
  }

  const catLabel = key => ({ spirits: 'Spirits', beer: 'Beer', cocktail: 'Cocktails', na: 'No Alc', snacks: 'Snacks', all: 'All' }[key] || key)

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e8e0d0', fontFamily: 'system-ui, sans-serif', paddingBottom: cartCount > 0 ? '230px' : '40px' }}>
      {/* Header — demo aesthetic */}
      <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid #1a1a24', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: '800', fontSize: '0.95rem', color: '#e8e0d0' }}>{event.name}</div>
          <div style={{ fontSize: '0.72rem', color: '#8a8098' }}>
            {balance ? 'Spending doves · order in one tap' : 'Load doves to start ordering'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {cartCount > 0 && (
            <div style={{ background: BRAND.pink, color: '#fff', borderRadius: '99px', fontSize: '0.72rem', fontWeight: '800', padding: '0.2rem 0.6rem' }}>
              {cartCount} in cart
            </div>
          )}
          {balance ? (
            <button onClick={() => setLoadOpen(true)} style={{
              background: 'transparent', border: `1px solid ${BRAND.neon}55`, borderRadius: '999px',
              padding: '0.35rem 0.8rem', color: BRAND.neon, fontSize: '0.78rem', fontWeight: '800', cursor: 'pointer',
            }}>
              🕊 ${(balanceRemaining / 100).toFixed(2)}
            </button>
          ) : (
            <button onClick={() => setLoadOpen(true)} style={{
              background: 'transparent', border: `1px solid ${BRAND.orange}55`, borderRadius: '999px',
              padding: '0.35rem 0.8rem', color: BRAND.orange, fontSize: '0.78rem', fontWeight: '800', cursor: 'pointer',
            }}>
              + Load Doves
            </button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      {categories.length > 2 && (
        <div style={{ display: 'flex', gap: '0.4rem', padding: '0.8rem 1rem 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {categories.map(key => (
            <button key={key} onClick={() => setCat(key)} style={{
              flexShrink: 0, padding: '0.4rem 0.9rem', borderRadius: '99px', border: 'none', cursor: 'pointer',
              fontSize: '0.78rem', fontWeight: cat === key ? '800' : '600',
              background: cat === key ? BRAND.pink : '#1c1c24',
              color: cat === key ? '#fff' : '#8a8098',
              transition: 'all 0.15s',
            }}>
              {catLabel(key)}
            </button>
          ))}
        </div>
      )}

      {/* Menu grid — demo aesthetic with ADD button + stepper */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', padding: '1rem' }}>
        {visible.map(item => {
          const inCart = cart.find(c => c.item.id === item.id)
          const qty = inCart?.qty || 0
          return (
            <div key={item.id} style={{
              background: qty > 0 ? '#0d0d18' : '#111',
              border: `1px solid ${qty > 0 ? BRAND.pink + '55' : '#1e1e2a'}`,
              borderRadius: '12px', overflow: 'hidden',
              transition: 'border-color 0.15s, background 0.15s',
            }}>
              {item.img ? (
                <img src={item.img} alt={item.name} style={{ width: '100%', height: '90px', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{
                  width: '100%', height: '90px',
                  background: 'linear-gradient(135deg, #1a1409, #0a0805)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '2.2rem',
                }}>{item.emoji || '🥂'}</div>
              )}
              <div style={{ padding: '0.65rem 0.75rem 0.75rem' }}>
                <div style={{ fontWeight: '700', fontSize: '0.88rem', color: '#e8e0d0', marginBottom: '0.15rem' }}>{item.name}</div>
                {item.description && (
                  <div style={{ fontSize: '0.72rem', color: '#5a5070', marginBottom: '0.6rem', lineHeight: 1.3, height: '1.86em', overflow: 'hidden' }}>
                    {item.description}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.9rem', color: qty > 0 ? BRAND.neon : BRAND.orange }}>
                    {fmt(item.price, event.currency)}
                  </span>
                  {qty === 0 ? (
                    <button onClick={() => addToCart(item)} style={{
                      background: BRAND.gradientAngle, color: '#000', border: 'none',
                      borderRadius: '6px', padding: '0.25rem 0.7rem', fontSize: '0.8rem',
                      fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit',
                    }}>ADD</button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button onClick={() => removeFromCart(item.id)} style={{ background: '#222', border: 'none', color: '#e8e0d0', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, fontFamily: 'inherit' }}>−</button>
                      <span style={{ color: BRAND.neon, fontWeight: '700', fontSize: '0.9rem', minWidth: '16px', textAlign: 'center' }}>{qty}</span>
                      <button onClick={() => addToCart(item)} style={{ background: '#222', border: 'none', color: '#e8e0d0', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, fontFamily: 'inherit' }}>+</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Cart footer — sticky, always visible when cart has items */}
      {cartCount > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'rgba(10,10,16,0.95)', backdropFilter: 'blur(12px)',
          borderTop: '1px solid #1a1a24', padding: '0.85rem 1rem 1rem', zIndex: 20,
        }}>
          <div style={{ background: '#111', border: `1px solid #1e1e2a`, borderRadius: '12px', padding: '0.7rem 0.9rem', marginBottom: '0.7rem' }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name (so the bartender can call you)"
              style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', fontSize: '0.88rem', color: '#e8e0d0', fontFamily: 'inherit' }}
            />
          </div>
          {payErr && (
            <div style={{ color: BRAND.orange, fontSize: '0.78rem', marginBottom: '0.5rem', textAlign: 'center' }}>{payErr}</div>
          )}
          <button
            onClick={submitOrder}
            disabled={placing}
            style={{
              width: '100%', background: placing ? '#1a1a24' : BRAND.gradientAngle,
              border: 'none', borderRadius: '12px', padding: '0.95rem',
              fontSize: '1rem', fontWeight: '900', color: '#000',
              cursor: placing ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontFamily: 'inherit',
            }}
          >
            <span>
              {placing ? 'Placing…' : balance ? 'Place Order' : 'Load doves to order'}
            </span>
            <span>{fmt(cartTotal, event.currency)}</span>
          </button>
        </div>
      )}

      {loadOpen && (
        <LoadDovesModal
          event={event}
          onClose={() => setLoadOpen(false)}
          onLoaded={(b) => {
            setBalance(b)
            if (b?.token) localStorage.setItem(tokenKey, b.token)
            if (b?.customer_name && !name) setName(b.customer_name)
            setLoadOpen(false)
          }}
        />
      )}
    </div>
  )
}

// BarCheckoutModal removed: per-drink card checkout was deprecated in
// favor of a doves-only flow (load a balance once, debit per order). The
// netlify/functions/create-bar-payment-intent.js function is now unused
// and can be deleted in a follow-up.

function BarPaymentStep({ onSuccess }) {
  const stripe   = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    setErr('')
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: 'if_required' })
    if (error) {
      setErr(error.message || 'Payment failed')
      setSubmitting(false)
      return
    }
    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
      await onSuccess(paymentIntent)
    } else {
      setErr(`Unexpected payment status: ${paymentIntent?.status || 'unknown'}`)
    }
    setSubmitting(false)
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <PaymentElement options={{ layout: 'tabs', wallets: { link: 'never' } }} />
      {err && <div style={{ color: C.red, fontSize: '0.85rem' }}>{err}</div>}
      <button type="submit" disabled={!stripe || submitting} style={{
        background: submitting ? '#1a1a1a' : C.gold, color: '#000', border: 'none', borderRadius: '10px',
        padding: '0.95rem', fontSize: '0.95rem', fontWeight: '800', cursor: submitting ? 'wait' : 'pointer',
        fontFamily: 'system-ui, sans-serif', opacity: submitting ? 0.6 : 1,
      }}>
        {submitting ? 'Processing…' : 'Pay now'}
      </button>
    </form>
  )
}

// ─── LOAD DOVES MODAL ─────────────────────────────────────────────────────────
const LOAD_PRESETS = [25, 50, 100, 200]

function LoadDovesModal({ event, onClose, onLoaded }) {
  const [stage, setStage] = useState('amount')   // amount | pay
  const [amount, setAmount] = useState(50)        // dollars
  const [name, setName]     = useState('')
  const [email, setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr]       = useState('')
  const [clientSecret, setClientSecret] = useState(null)

  const proceed = async (e) => {
    e?.preventDefault()
    setErr('')
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) { setErr('Valid email required.'); return }
    if (!amount || amount < 5) { setErr('Minimum load is $5.'); return }
    setLoading(true)
    try {
      const res = await fetch('/.netlify/functions/create-dove-load-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id:      event.id,
          amount_cents:  Math.round(amount * 100),
          email,
          customer_name: name,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.clientSecret) throw new Error(json.error || 'Could not start load')
      setClientSecret(json.clientSecret)
      setStage('pay')
    } catch (e) {
      setErr(e.message)
    }
    setLoading(false)
  }

  const onPaid = async (paymentIntent) => {
    try {
      const res = await fetch('/.netlify/functions/finalize-dove-load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_intent_id: paymentIntent.id,
          customer_name:     name,
          email,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.balance) throw new Error(json.error || 'Could not save balance')
      onLoaded(json.balance)
    } catch (e) {
      setErr(`Charge succeeded but balance failed to save: ${e.message}. Save this PI: ${paymentIntent.id}`)
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#0f0f0f', width: '100%', maxWidth: '480px',
        borderRadius: '22px 22px 0 0', borderTop: `1px solid ${C.border}`,
        maxHeight: '90vh', overflow: 'auto', padding: '1.5rem 1.5rem 2rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.65rem', color: C.goldLight, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: '700' }}>
              {stage === 'amount' ? 'Load Doves' : 'Pay'}
            </div>
            <div style={{ color: C.text, fontSize: '1.4rem', fontWeight: '900', letterSpacing: '-0.02em' }}>
              ${amount}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textMid, fontSize: '1.6rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {stage === 'amount' && (
          <>
            <div style={{ color: C.textMid, fontSize: '0.85rem', lineHeight: 1.55, marginBottom: '1rem' }}>
              Card is charged once now. Whatever you don't spend gets refunded after the show closes — no card prompt per drink. Refunds usually arrive instantly when the bar closes out, but Stripe can take up to 7 days in rare cases.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.85rem' }}>
              {LOAD_PRESETS.map(p => (
                <button
                  key={p}
                  onClick={() => setAmount(p)}
                  style={{
                    padding: '0.7rem 0.4rem', borderRadius: '10px',
                    border: `1px solid ${amount === p ? C.gold : C.border}`,
                    background: amount === p ? '#1a1000' : C.card,
                    color: amount === p ? C.goldLight : C.textMid,
                    fontWeight: '800', fontSize: '0.92rem', cursor: 'pointer',
                  }}
                >
                  ${p}
                </button>
              ))}
            </div>
            <input
              type="number"
              min="5"
              max="1000"
              value={amount}
              onChange={e => setAmount(Number(e.target.value) || 0)}
              placeholder="Custom amount"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#1a1a1a', border: `1px solid ${C.border}`,
                borderRadius: '10px', color: C.text, padding: '0.8rem 1rem',
                fontSize: '0.95rem', outline: 'none', marginBottom: '0.7rem',
              }}
            />
            <form onSubmit={proceed} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name (so the bartender can call you)"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: '#1a1a1a', border: `1px solid ${C.border}`,
                  borderRadius: '10px', color: C.text, padding: '0.8rem 1rem',
                  fontSize: '0.95rem', outline: 'none',
                }}
              />
              <input
                type="email" required
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email — for refund receipt"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: '#1a1a1a', border: `1px solid ${C.border}`,
                  borderRadius: '10px', color: C.text, padding: '0.8rem 1rem',
                  fontSize: '0.95rem', outline: 'none',
                }}
              />
              {err && <div style={{ color: C.red, fontSize: '0.82rem' }}>{err}</div>}
              <button type="submit" disabled={loading} style={{
                background: loading ? '#1a1a1a' : C.gold, color: '#000', border: 'none', borderRadius: '10px',
                padding: '0.95rem', fontSize: '0.95rem', fontWeight: '800', cursor: loading ? 'wait' : 'pointer',
                marginTop: '0.4rem', opacity: loading ? 0.6 : 1,
              }}>
                {loading ? 'Loading…' : `Continue — load $${amount}`}
              </button>
              <div style={{ textAlign: 'center', color: C.textDim, fontSize: '0.7rem', marginTop: '0.25rem' }}>
                Unspent doves refunded to your card when the bar closes out — usually instant, up to 7 days in rare cases.
              </div>
            </form>
          </>
        )}

        {stage === 'pay' && clientSecret && stripePromise && (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
            <BarPaymentStep onSuccess={onPaid} />
          </Elements>
        )}
        {stage === 'pay' && !stripePromise && (
          <div style={{ color: C.red, fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
            Stripe not configured. Set VITE_STRIPE_PUBLISHABLE_KEY.
          </div>
        )}
        {err && stage === 'pay' && (
          <div style={{ color: C.red, fontSize: '0.85rem', marginTop: '0.5rem' }}>{err}</div>
        )}
      </div>
    </div>
  )
}

// ─── STAFF VIEW ────────────────────────────────────────────────────────────────
function StaffView({ event, orders, onStatusChange }) {
  const queues = {
    pending: orders.filter(o => o.status === 'pending'),
    making:  orders.filter(o => o.status === 'making'),
    ready:   orders.filter(o => o.status === 'ready'),
    done:    orders.filter(o => o.status === 'done'),
  }
  const totalRevenue = queues.done.reduce((s, o) => s + o.total, 0)
  const statusColors = { pending: C.amber, making: C.blue, ready: C.green, done: C.textDim }
  // Staff transitions stop at "ready" — the customer closes the loop by
  // confirming pickup on their own phone, which flips the order to "done".
  // Staff keeps a fallback "Mark picked up" button (rendered separately
  // below) for cases where the customer can't / doesn't tap.
  const nextStatus   = { pending: 'making', making: 'ready' }
  const nextLabel    = { pending: 'Start Making', making: 'Mark Ready' }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui, sans-serif', paddingBottom: '2rem' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.2rem', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: C.bg, zIndex: 10 }}>
        <div>
          <div style={{ color: C.goldLight, fontWeight: '800', fontSize: '1rem' }}>{event.name} — Bar Queue</div>
          <div style={{ color: C.textMid, fontSize: '0.75rem' }}>
            {queues.pending.length + queues.making.length} active · {fmt(totalRevenue, event.currency)} collected
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, overflowX: 'auto' }}>
        {[
          { label: 'Waiting', count: queues.pending.length, color: C.amber },
          { label: 'Making',  count: queues.making.length,  color: C.blue },
          { label: 'Ready',   count: queues.ready.length,   color: C.green },
          { label: 'Done',    count: queues.done.length,    color: C.textDim },
        ].map(({ label, count, color }) => (
          <div key={label} style={{ flex: 1, textAlign: 'center', padding: '0.7rem', borderRight: `1px solid ${C.border}` }}>
            <div style={{ color, fontSize: '1.4rem', fontWeight: '800' }}>{count}</div>
            <div style={{ color: C.textMid, fontSize: '0.7rem' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Orders */}
      <div style={{ padding: '1rem' }}>
        {[...queues.pending, ...queues.making].length === 0 && (
          <div style={{ textAlign: 'center', color: C.textDim, padding: '3rem', fontSize: '0.9rem' }}>
            No active orders — you're caught up 🌅
          </div>
        )}

        {[...queues.pending, ...queues.making].map(order => (
          <div key={order.id} style={{ background: C.card, border: `1px solid ${statusColors[order.status]}33`, borderLeft: `3px solid ${statusColors[order.status]}`, borderRadius: '10px', padding: '0.9rem 1rem', marginBottom: '0.7rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{ background: statusColors[order.status], color: '#000', borderRadius: '6px', padding: '0.15rem 0.55rem', fontWeight: '800', fontSize: '1rem' }}>
                  #{order.id}
                </div>
                <span style={{ color: C.text, fontWeight: '800', fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
                  {order.customer_name || 'No name'}
                </span>
              </div>
              <div style={{ color: C.textMid, fontSize: '0.75rem' }}>{fmtTime(order.created_at)}</div>
            </div>

            <div style={{ marginBottom: '0.7rem' }}>
              {order.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0', borderBottom: i < order.items.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ fontSize: '1.1rem' }}>{item.emoji}</span>
                  <span style={{ color: C.text, flex: 1 }}>{item.name}</span>
                  <span style={{ background: '#222', borderRadius: '99px', padding: '0.1rem 0.5rem', color: C.textMid, fontSize: '0.8rem', fontWeight: '700' }}>×{item.qty}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ color: C.goldLight, fontWeight: '700' }}>{fmt(order.total, event.currency)}</div>
              {nextStatus[order.status] && (
                <button onClick={() => onStatusChange(order.id, nextStatus[order.status])} style={{ background: statusColors[nextStatus[order.status]] + '22', border: `1px solid ${statusColors[nextStatus[order.status]]}`, color: statusColors[nextStatus[order.status]], borderRadius: '8px', padding: '0.4rem 0.9rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem' }}>
                  {nextLabel[order.status]}
                </button>
              )}
            </div>
          </div>
        ))}

        {queues.ready.length > 0 && (
          <>
            <div style={{ color: C.textMid, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '1rem', marginBottom: '0.5rem' }}>
              Ready — Waiting for pickup
            </div>
            {queues.ready.map(order => (
              <div key={order.id} style={{
                background: '#0d1f0d', border: `1px solid ${C.greenDim}`,
                borderRadius: '10px', padding: '0.85rem 1rem', marginBottom: '0.5rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0, flex: 1 }}>
                  <div style={{ color: C.green, fontWeight: '900', fontSize: '1.05rem', flexShrink: 0 }}>
                    #{order.id}
                  </div>
                  {/* Customer name — large so the bartender can call it out
                      across a noisy room and match the right person. */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: C.text, fontSize: '1.15rem', fontWeight: '800', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {order.customer_name || 'No name'}
                    </div>
                    <div style={{ color: C.textDim, fontSize: '0.78rem', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {order.items.map(i => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(', ')}
                    </div>
                  </div>
                </div>
                <button onClick={() => onStatusChange(order.id, 'done')} style={{
                  background: C.greenDim, border: `1px solid ${C.green}`, color: C.green,
                  borderRadius: '8px', padding: '0.45rem 0.85rem', cursor: 'pointer',
                  fontWeight: '700', fontSize: '0.78rem', flexShrink: 0,
                }}>
                  Picked Up ✓
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ─── STAFF PIN GATE ────────────────────────────────────────────────────────────
function StaffPinGate({ pin: correctPin, onUnlock }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(false)

  const attempt = () => {
    if (pin === correctPin) { onUnlock() }
    else { setErr(true); setPin('') }
  }

  return (
    <Centered>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '16px', padding: '2rem', maxWidth: '320px', width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔒</div>
        <div style={{ color: C.goldLight, fontWeight: '700', fontSize: '1rem', marginBottom: '0.3rem' }}>Staff Mode</div>
        <div style={{ color: C.textMid, fontSize: '0.8rem', marginBottom: '1.5rem' }}>Enter staff PIN to access the queue</div>
        <input
          autoFocus type="password" inputMode="numeric" placeholder="PIN"
          value={pin}
          onChange={e => { setPin(e.target.value); setErr(false) }}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          style={{ width: '100%', background: '#1a1a1a', border: `1px solid ${err ? C.red : C.border}`, borderRadius: '8px', color: C.text, padding: '0.8rem', fontSize: '1.2rem', textAlign: 'center', letterSpacing: '0.3em', outline: 'none', boxSizing: 'border-box', marginBottom: '0.5rem' }}
        />
        {err && <div style={{ color: C.red, fontSize: '0.8rem', marginBottom: '0.5rem' }}>Incorrect PIN</div>}
        <button onClick={attempt} style={{ width: '100%', background: C.gold, color: '#000', border: 'none', borderRadius: '8px', padding: '0.8rem', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer' }}>
          Unlock
        </button>
      </div>
    </Centered>
  )
}

// ─── MAIN: EVENT BAR ──────────────────────────────────────────────────────────
export default function EventBar({ staffMode = false }) {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [event,    setEvent]   = useState(null)
  const [menu,     setMenu]    = useState([])
  const [orders,   setOrders]  = useState([])
  const [loading,  setLoading] = useState(true)
  const [notFound, setNotFound]= useState(false)
  const [unlocked, setUnlocked]= useState(false)
  const channelRef = useRef(null)

  // ── fetch event + menu ────────────────────────────────────────────────────────
  // Supports either an event slug OR a promoter handle. Handle hits redirect
  // to the canonical event-slug URL so deep-links and shares stay clean.
  useEffect(() => {
    async function load() {
      setLoading(true)

      const { data: ev, error: evErr } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .eq('active', true)
        .single()

      if (evErr || !ev) {
        // Not an event slug — try as a promoter handle
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('handle', slug)
          .maybeSingle()
        if (user) {
          const { data: rows } = await supabase
            .from('events')
            .select('slug, show_date')
            .eq('promoter_id', user.id)
            .order('show_date', { ascending: false })
            .limit(20)
          const list = rows || []
          const now = Date.now()
          const dateOf = (e) => new Date(e.event_date || e.show_date || 0).getTime()
          const upcoming = list.filter(e => dateOf(e) >= now).sort((a, b) => dateOf(a) - dateOf(b))
          const target = upcoming[0] || list[0]
          if (target?.slug) {
            const tail = staffMode ? '/bar/staff' : '/bar'
            navigate(`/${target.slug}${tail}`, { replace: true })
            return
          }
        }
        setNotFound(true); setLoading(false); return
      }
      setEvent(ev)

      const { data: items } = await supabase
        .from('bar_menu_items')
        .select('*')
        .eq('event_id', ev.id)
        .eq('active', true)
        .order('sort_order')

      // Normalize price_cents (new schema) → price (display dollars).
      // Falls back to legacy `price` column if present.
      setMenu((items || []).map(it => ({
        ...it,
        price:    it.price != null ? it.price : (it.price_cents || 0) / 100,
        emoji:    it.emoji || '🥂',
        // Promoter's uploaded photo wins; fall back to featured template
        img:      it.image_url || imageFor(it.name),
        // Promoter description wins; fall back to featured-drink default
        description: it.description || descFor(it.name) || '',
        category: it.category || 'all',
      })))

      // Load existing orders for staff view
      if (staffMode) {
        const { data: existing } = await supabase
          .from('bar_orders')
          .select('*')
          .eq('event_id', ev.id)
          .neq('status', 'done')
          .order('created_at', { ascending: true })
        setOrders(existing || [])
      }

      setLoading(false)

      // ── Realtime subscription ─────────────────────────────────────────────────
      const channel = supabase
        .channel(`bar-orders-${ev.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'bar_orders',
          filter: `event_id=eq.${ev.id}`,
        }, payload => {
          setOrders(prev => {
            if (prev.find(o => o.id === payload.new.id)) return prev
            return [payload.new, ...prev]
          })
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'bar_orders',
          filter: `event_id=eq.${ev.id}`,
        }, payload => {
          setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new : o))
        })
        .subscribe()

      channelRef.current = channel
    }

    load()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
  }, [slug, staffMode])

  const handleOrderPlaced = order => {
    // Optimistic — realtime INSERT will confirm it
    setOrders(prev => [order, ...prev])
  }

  const handleStatusChange = async (orderId, newStatus) => {
    // Optimistic update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
    await supabase.from('bar_orders').update({ status: newStatus }).eq('id', orderId)
  }

  if (loading) return (
    <Centered>
      <div style={{ color: C.textMid, fontFamily: 'system-ui, sans-serif' }}>Loading…</div>
    </Centered>
  )

  if (notFound) return (
    <Centered>
      <div style={{ textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🕊</div>
        <div style={{ color: C.text, fontWeight: '700', fontSize: '1.1rem', marginBottom: '0.4rem' }}>Event not found</div>
        <div style={{ color: C.textMid, fontSize: '0.85rem' }}>Check the link and try again.</div>
      </div>
    </Centered>
  )

  // Staff flow
  if (staffMode) {
    if (!unlocked) return <StaffPinGate pin={event.staff_pin || '7777'} onUnlock={() => setUnlocked(true)} />
    return <StaffView event={event} orders={orders} onStatusChange={handleStatusChange} />
  }

  // Customer flow
  return <CustomerView event={event} menu={menu} onOrderPlaced={handleOrderPlaced} />
}
