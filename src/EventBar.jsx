import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './supabase'

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

function fmt(n, currency = 'MXN') {
  return currency === 'USD' ? `$${n}` : `$${Math.round(n)}`
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
  const [confirmed, setConfirmed] = useState(null)
  const [name,      setName]      = useState('')
  const [showName,  setShowName]  = useState(false)
  const [placing,   setPlacing]   = useState(false)

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

  const submitOrder = async () => {
    if (!name.trim()) { setShowName(true); return }
    setPlacing(true)
    const orderId = genOrderId()
    const order = {
      id:            orderId,
      event_id:      event.id,
      customer_name: name.trim(),
      items:         cart.map(c => ({ id: c.item.id, name: c.item.name, emoji: c.item.emoji, price: c.item.price, qty: c.qty })),
      total:         cartTotal,
      status:        'pending',
    }
    const { error } = await supabase.from('bar_orders').insert(order)
    setPlacing(false)
    if (error) { alert('Could not place order. Try again.'); return }
    onOrderPlaced(order)
    setConfirmed(orderId)
    setCart([])
    setCartOpen(false)
    setName('')
    setShowName(false)
  }

  if (confirmed) return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '2rem',
      textAlign: 'center', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🌅</div>
      <div style={{ color: C.green, fontSize: '1.6rem', fontWeight: '800', marginBottom: '0.4rem' }}>
        Order #{confirmed}
      </div>
      <div style={{ color: C.textMid, fontSize: '0.95rem', marginBottom: '2rem' }}>
        The bartender has your order. We'll call you when it's ready.
      </div>
      <button
        style={{ background: C.gold, color: '#000', border: 'none', borderRadius: '10px', padding: '0.9rem 2rem', fontSize: '1rem', fontWeight: '700', cursor: 'pointer' }}
        onClick={() => setConfirmed(null)}
      >
        Order Again
      </button>
    </div>
  )

  const catLabel = key => ({ spirits: 'Spirits', beer: 'Beer', cocktail: 'Cocktails', na: 'No Alc', snacks: 'Snacks', all: 'All' }[key] || key)

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui, sans-serif', paddingBottom: cartCount > 0 ? '160px' : '40px' }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.2rem 0.5rem', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: C.goldLight, fontWeight: '800', fontSize: '1.05rem' }}>{event.name}</div>
          <div style={{ color: C.textMid, fontSize: '0.75rem' }}>Order now · pay on pickup</div>
        </div>
        <div style={{ color: C.textDim, fontSize: '0.75rem' }}>🕊 Doves</div>
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', padding: '0.8rem 1rem', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {categories.map(key => (
          <button key={key} onClick={() => setCat(key)} style={{
            flexShrink: 0, padding: '0.45rem 1rem', borderRadius: '99px', border: 'none', cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: cat === key ? '700' : '500',
            background: cat === key ? C.gold : '#1c1c1c',
            color: cat === key ? '#000' : C.textMid,
            transition: 'all 0.15s',
          }}>
            {catLabel(key)}
          </button>
        ))}
      </div>

      {/* Menu grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.6rem', padding: '0 1rem' }}>
        {visible.map(item => {
          const inCart = cart.find(c => c.item.id === item.id)
          return (
            <button key={item.id} onClick={() => addToCart(item)} style={{
              background: C.card, border: `1px solid ${inCart ? C.goldDim : C.border}`,
              borderRadius: '12px', padding: '1rem 0.8rem', cursor: 'pointer',
              textAlign: 'left', transition: 'all 0.15s', position: 'relative', outline: 'none',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>{item.emoji}</div>
              <div style={{ color: C.text, fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.2rem' }}>{item.name}</div>
              <div style={{ color: C.goldLight, fontWeight: '700', fontSize: '0.95rem' }}>{fmt(item.price, event.currency)}</div>
              {inCart && (
                <div style={{
                  position: 'absolute', top: '0.5rem', right: '0.5rem',
                  background: C.gold, color: '#000', borderRadius: '99px',
                  width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: '800',
                }}>
                  {inCart.qty}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Cart sheet */}
      {cartCount > 0 && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#141414', borderTop: `1px solid ${C.goldDim}`,
          padding: '0.8rem 1rem', zIndex: 20,
          maxHeight: cartOpen ? '70vh' : '80px',
          overflow: 'hidden', transition: 'max-height 0.25s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => setCartOpen(o => !o)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
              <div style={{ background: C.gold, color: '#000', borderRadius: '99px', padding: '0.2rem 0.7rem', fontWeight: '800', fontSize: '0.85rem' }}>
                {cartCount}
              </div>
              <span style={{ color: C.text, fontWeight: '600' }}>
                {cartOpen ? 'Your order' : `${cartCount} item${cartCount > 1 ? 's' : ''}`}
              </span>
            </div>
            <div style={{ color: C.goldLight, fontWeight: '700', fontSize: '1rem' }}>{fmt(cartTotal, event.currency)}</div>
          </div>

          {cartOpen && (
            <div style={{ marginTop: '0.8rem', overflowY: 'auto', maxHeight: 'calc(70vh - 120px)' }}>
              {cart.map(({ item, qty }) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '1.3rem' }}>{item.emoji}</span>
                    <div>
                      <div style={{ color: C.text, fontSize: '0.9rem' }}>{item.name}</div>
                      <div style={{ color: C.textMid, fontSize: '0.75rem' }}>{fmt(item.price, event.currency)} each</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                    <button style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#222', border: 'none', color: C.text, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={e => { e.stopPropagation(); removeFromCart(item.id) }}>−</button>
                    <span style={{ color: C.text, fontWeight: '700', minWidth: '16px', textAlign: 'center' }}>{qty}</span>
                    <button style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#222', border: 'none', color: C.text, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={e => { e.stopPropagation(); addToCart(item) }}>+</button>
                    <span style={{ color: C.goldLight, fontWeight: '600', minWidth: '55px', textAlign: 'right' }}>
                      {fmt(item.price * qty, event.currency)}
                    </span>
                  </div>
                </div>
              ))}

              {showName && (
                <div style={{ marginTop: '0.8rem' }}>
                  <input
                    autoFocus
                    style={{ width: '100%', background: '#1a1a1a', border: `1px solid ${C.goldDim}`, borderRadius: '8px', color: C.text, padding: '0.7rem', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
                    placeholder="Your name (so we can call you)"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitOrder()}
                  />
                </div>
              )}

              <button
                onClick={submitOrder}
                disabled={placing}
                style={{ width: '100%', background: placing ? C.goldDim : C.gold, color: '#000', border: 'none', borderRadius: '10px', padding: '0.9rem', fontSize: '1rem', fontWeight: '800', cursor: placing ? 'wait' : 'pointer', marginTop: '0.8rem' }}
              >
                {placing ? 'Placing…' : showName ? 'Place Order →' : 'Order Now →'}
              </button>
            </div>
          )}
        </div>
      )}
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
  const nextStatus   = { pending: 'making', making: 'ready', ready: 'done' }
  const nextLabel    = { pending: 'Start Making', making: 'Mark Ready', ready: 'Picked Up ✓' }

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
                <span style={{ color: C.text, fontWeight: '600' }}>{order.customer_name}</span>
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
              <div key={order.id} style={{ background: '#0d1f0d', border: `1px solid ${C.greenDim}`, borderRadius: '10px', padding: '0.7rem 1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ color: C.green, fontWeight: '800', fontSize: '1rem' }}>#{order.id}</div>
                  <span style={{ color: C.text }}>{order.customer_name}</span>
                  <span style={{ color: C.textDim, fontSize: '0.75rem' }}>
                    {order.items.map(i => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(', ')}
                  </span>
                </div>
                <button onClick={() => onStatusChange(order.id, 'done')} style={{ background: C.greenDim, border: `1px solid ${C.green}`, color: C.green, borderRadius: '8px', padding: '0.35rem 0.8rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem' }}>
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
  const [event,    setEvent]   = useState(null)
  const [menu,     setMenu]    = useState([])
  const [orders,   setOrders]  = useState([])
  const [loading,  setLoading] = useState(true)
  const [notFound, setNotFound]= useState(false)
  const [unlocked, setUnlocked]= useState(false)
  const channelRef = useRef(null)

  // ── fetch event + menu ────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)

      const { data: ev, error: evErr } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .eq('active', true)
        .single()

      if (evErr || !ev) { setNotFound(true); setLoading(false); return }
      setEvent(ev)

      const { data: items } = await supabase
        .from('bar_menu_items')
        .select('*')
        .eq('event_id', ev.id)
        .eq('active', true)
        .order('sort_order')

      setMenu(items || [])

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
