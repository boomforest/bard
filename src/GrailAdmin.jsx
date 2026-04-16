import React, { useState, useEffect } from 'react'
import {
  FileText, Beer, Calculator, ChevronRight,
  Circle, CheckCircle2, Clock, Zap, DoorOpen, Users
} from 'lucide-react'
import GrailTable from './GrailTable'
import { StaffView } from './GrailBar'
import GrailDoor from './GrailDoor'
import GrailContacts from './GrailContacts'
import { grailStore } from './grailStore'

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────
const SIDEBAR_W = 220
const MOBILE_BP = 768

const C = {
  bg:        '#080808',
  sidebar:   '#0d0d0d',
  surface:   '#111',
  card:      '#141414',
  border:    '#1c1c1c',
  borderAlt: '#2a1a00',
  gold:      '#c8922a',
  goldLight: '#e8b84b',
  goldDim:   '#6b4a14',
  green:     '#22c55e',
  greenDim:  '#14532d',
  amber:     '#d97316',
  red:       '#ef4444',
  text:      '#e8e0d0',
  textMid:   '#9a8878',
  textDim:   '#3a3028',
}

// ─── NAV ITEMS ─────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'table',   label: 'Contract',  Icon: FileText,    desc: 'Living event contract' },
  { id: 'bar',     label: 'Bar Queue', Icon: Beer,        desc: 'Live order queue' },
  { id: 'door',    label: 'Door',      Icon: DoorOpen,    desc: 'Scan + show mode' },
  { id: 'settle',  label: 'Settlement',Icon: Calculator,  desc: 'Post-event payout' },
  { id: 'contacts',label: 'Contacts',  Icon: Users,       desc: 'Mailing list' },
]

// ─── SETTLEMENT VIEW (admin-side, dense) ──────────────────────────────────────
function AdminSettlement({ orders, doveRevenue }) {
  // In production this reads from the contract state — for now uses order data
  const posBarRevenue  = orders.filter(o => o.status === 'done').reduce((s, o) => s + o.total, 0)
  const totalBar       = posBarRevenue + doveRevenue   // staff POS + dove app purchases
  const barProducerCut = Math.round(totalBar * 0.3)

  // Placeholder numbers — wired to real contract in next iteration
  const projectedTickets = 75000
  const projectedCosts   = 21000
  const profit           = projectedTickets + barProducerCut - projectedCosts

  const producers = [
    { name: 'JP',     weight: 40, role: 'Promoter' },
    { name: 'Maddox', weight: 60, role: 'Venue' },
  ]
  const totalWeight = producers.reduce((s, p) => s + p.weight, 0)

  function fmt(n) { return `$${Math.round(n).toLocaleString()} MXN` }

  return (
    <div style={{ padding: '2rem', maxWidth: '860px' }}>
      <h2 style={{ color: C.goldLight, fontWeight: '800', fontSize: '1.3rem', marginBottom: '0.3rem' }}>
        Settlement
      </h2>
      <p style={{ color: C.textMid, fontSize: '0.85rem', marginBottom: '2rem', marginTop: 0 }}>
        Based on agreed rules + actual inputs — no spreadsheet, no debate.
      </p>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Ticket Revenue', value: fmt(projectedTickets), color: C.text },
          { label: 'Bar (Producer %)', value: fmt(barProducerCut), color: C.text },
          { label: 'Total Costs',    value: fmt(projectedCosts),   color: C.red },
          { label: 'Net Profit',     value: fmt(profit),           color: profit > 0 ? C.green : C.red },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: '10px',
            padding: '1rem 1.1rem',
          }}>
            <div style={{ fontSize: '0.7rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>
              {label}
            </div>
            <div style={{ color, fontSize: '1.1rem', fontWeight: '700' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Distribution table */}
      <div style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: '12px',
        overflow: 'hidden',
        marginBottom: '2rem',
      }}>
        <div style={{
          padding: '0.8rem 1.2rem',
          borderBottom: `1px solid ${C.border}`,
          color: C.goldLight,
          fontWeight: '700',
          fontSize: '0.9rem',
        }}>
          Distribution
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#0f0f0f' }}>
              {['Producer', 'Role', 'Weight', 'Amount', ''].map(h => (
                <th key={h} style={{
                  padding: '0.6rem 1.2rem',
                  textAlign: 'left',
                  fontSize: '0.7rem',
                  color: C.textMid,
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {producers.map((p, i) => {
              const amount = profit > 0 ? profit * p.weight / totalWeight : 0
              return (
                <tr key={p.name} style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
                  <td style={{ padding: '0.9rem 1.2rem', color: C.text, fontWeight: '600' }}>{p.name}</td>
                  <td style={{ padding: '0.9rem 1.2rem', color: C.textMid, fontSize: '0.85rem' }}>{p.role}</td>
                  <td style={{ padding: '0.9rem 1.2rem', color: C.textMid, fontSize: '0.85rem' }}>{p.weight} pts</td>
                  <td style={{ padding: '0.9rem 1.2rem', color: C.green, fontWeight: '700', fontSize: '1rem' }}>
                    {fmt(amount)}
                  </td>
                  <td style={{ padding: '0.9rem 1.2rem' }}>
                    <button style={{
                      background: 'transparent',
                      border: `1px solid ${C.border}`,
                      borderRadius: '6px',
                      color: C.textMid,
                      padding: '0.3rem 0.7rem',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}>
                      Trace
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Bar breakdown */}
      {(orders.filter(o => o.status === 'done').length > 0 || doveRevenue > 0) && (
        <div style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '0.8rem 1.2rem',
            borderBottom: `1px solid ${C.border}`,
            color: C.goldLight,
            fontWeight: '700',
            fontSize: '0.9rem',
          }}>
            Bar Revenue Detail
          </div>
          <div style={{ padding: '1rem 1.2rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: C.textMid, marginBottom: '0.2rem' }}>STAFF POS</div>
              <div style={{ color: C.text, fontWeight: '600' }}>{fmt(posBarRevenue)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: C.textMid, marginBottom: '0.2rem' }}>🕊 DOVE APP</div>
              <div style={{ color: doveRevenue > 0 ? C.goldLight : C.textDim, fontWeight: '600' }}>{fmt(doveRevenue)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: C.textMid, marginBottom: '0.2rem' }}>GROSS BAR</div>
              <div style={{ color: C.text, fontWeight: '600' }}>{fmt(totalBar)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: C.textMid, marginBottom: '0.2rem' }}>PRODUCER CUT (30%)</div>
              <div style={{ color: C.text, fontWeight: '600' }}>{fmt(barProducerCut)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ active, setActive, pendingOrders, isMobile }) {
  if (isMobile) {
    return (
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        background: C.sidebar,
        borderTop: `1px solid ${C.border}`,
        display: 'flex',
        zIndex: 30,
      }}>
        {NAV.map(({ id, label, Icon }) => {
          const isActive = active === id
          const badge = id === 'bar' && pendingOrders > 0 ? pendingOrders : null
          return (
            <button
              key={id}
              onClick={() => setActive(id)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.2rem',
                padding: '0.6rem 0.3rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                borderTop: isActive ? `2px solid ${C.gold}` : '2px solid transparent',
              }}
            >
              <Icon size={20} color={isActive ? C.goldLight : C.textMid} strokeWidth={isActive ? 2 : 1.5} />
              <span style={{ fontSize: '0.65rem', color: isActive ? C.goldLight : C.textMid, fontWeight: isActive ? '700' : '400' }}>
                {label}
              </span>
              {badge && (
                <div style={{
                  position: 'absolute',
                  top: '6px', right: 'calc(50% - 20px)',
                  background: C.amber,
                  color: '#000',
                  borderRadius: '99px',
                  width: '16px', height: '16px',
                  fontSize: '0.6rem',
                  fontWeight: '800',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {badge}
                </div>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  // Desktop sidebar
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, bottom: 0,
      width: SIDEBAR_W,
      background: C.sidebar,
      borderRight: `1px solid ${C.border}`,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 30,
      overflow: 'hidden',
    }}>
      {/* Wordmark */}
      <div style={{
        padding: '1.4rem 1.4rem 1rem',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{
          color: C.goldLight,
          fontWeight: '900',
          fontSize: '1.1rem',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: '0.2rem',
        }}>
          GRAIL
        </div>
        <div style={{ color: C.textMid, fontSize: '0.72rem' }}>Admin Console</div>
      </div>

      {/* Event info */}
      <div style={{
        padding: '0.9rem 1.4rem',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ color: C.text, fontWeight: '600', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
          Sunrise at Juarez
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          background: '#1a0d00',
          border: `1px solid ${C.goldDim}`,
          borderRadius: '99px',
          padding: '0.18rem 0.55rem',
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.amber }} />
          <span style={{ color: C.amber, fontSize: '0.65rem', fontWeight: '700' }}>DRAFT</span>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '0.6rem 0', flex: 1 }}>
        {NAV.map(({ id, label, Icon, desc }) => {
          const isActive = active === id
          const badge    = id === 'bar' && pendingOrders > 0 ? pendingOrders : null
          return (
            <button
              key={id}
              onClick={() => setActive(id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.65rem 1.4rem',
                background: isActive ? '#1a1000' : 'transparent',
                border: 'none',
                borderLeft: isActive ? `2px solid ${C.gold}` : '2px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.1s',
              }}
            >
              <Icon
                size={17}
                color={isActive ? C.goldLight : C.textMid}
                strokeWidth={isActive ? 2 : 1.5}
                style={{ flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: isActive ? C.goldLight : C.textMid,
                  fontSize: '0.85rem',
                  fontWeight: isActive ? '700' : '400',
                  lineHeight: 1.2,
                }}>
                  {label}
                </div>
              </div>
              {badge && (
                <div style={{
                  background: C.amber,
                  color: '#000',
                  borderRadius: '99px',
                  padding: '0.05rem 0.45rem',
                  fontSize: '0.65rem',
                  fontWeight: '800',
                  minWidth: '18px',
                  textAlign: 'center',
                }}>
                  {badge}
                </div>
              )}
              {isActive && <ChevronRight size={13} color={C.goldDim} />}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '1rem 1.4rem',
        borderTop: `1px solid ${C.border}`,
      }}>
        <div style={{ color: C.textDim, fontSize: '0.68rem' }}>
          v0.1 · GRAIL Protocol
        </div>
        <a
          href="/grail/bar"
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            marginTop: '0.5rem',
            color: C.textMid,
            fontSize: '0.72rem',
            textDecoration: 'none',
            border: `1px solid ${C.border}`,
            borderRadius: '6px',
            padding: '0.3rem 0.6rem',
          }}
        >
          <Zap size={11} />
          Customer bar view ↗
        </a>
      </div>
    </div>
  )
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
export default function GrailAdmin() {
  const [active,       setActive]       = useState('table')
  const [orders,       setOrders]       = useState([])   // TODO: Supabase realtime
  const [doveRevenue,  setDoveRevenue]  = useState(0)    // from grailStore (Dove app purchases)
  const [isMobile,     setMobile]       = useState(window.innerWidth < MOBILE_BP)

  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'making').length

  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < MOBILE_BP)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Listen for dove spend events from the customer Doves app
  useEffect(() => {
    const unsub = grailStore.on('dove-transaction', () => {
      setDoveRevenue(grailStore.getDoveRevenue())
    })
    return unsub
  }, [])

  const handleStatusChange = (orderId, newStatus) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o))
    // TODO: update Supabase grail_bar_orders
  }

  const contentStyle = {
    marginLeft:    isMobile ? 0 : SIDEBAR_W,
    marginBottom:  isMobile ? 60 : 0,
    minHeight:     '100vh',
    background:    C.bg,
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Sidebar
        active={active}
        setActive={setActive}
        pendingOrders={pendingOrders}
        isMobile={isMobile}
      />

      <div style={contentStyle}>
        {active === 'table' && (
          <GrailTable sidebarOffset={isMobile ? 0 : SIDEBAR_W} />
        )}

        {active === 'bar' && (
          <div style={{ padding: isMobile ? '1rem' : '1.5rem 2rem', color: '#e8e0d0' }}>
            <div style={{ marginBottom: '1.5rem', maxWidth: '960px' }}>
              <h2 style={{ color: '#e8b84b', fontWeight: '800', fontSize: '1.2rem', margin: '0 0 0.2rem' }}>
                Bar Queue
              </h2>
              <p style={{ color: '#9a8878', fontSize: '0.85rem', margin: 0 }}>
                Live orders from the bar. Tap to advance status.
              </p>
              {doveRevenue > 0 && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  marginTop: '0.5rem',
                  background: '#1a1000',
                  border: '1px solid #6b4a14',
                  borderRadius: '8px',
                  padding: '0.3rem 0.7rem',
                  fontSize: '0.75rem',
                  color: '#e8b84b',
                }}>
                  🕊 Dove app: ${Math.round(doveRevenue).toLocaleString()} MXN collected
                </div>
              )}
            </div>
            <StaffView
              orders={orders}
              onStatusChange={handleStatusChange}
              onBack={null}
              embedded
            />
          </div>
        )}

        {active === 'door' && (
          // GrailDoor manages its own show/scan mode toggle internally
          <GrailDoor />
        )}

        {active === 'settle' && (
          <AdminSettlement orders={orders} doveRevenue={doveRevenue} />
        )}

        {active === 'contacts' && (
          <GrailContacts promoterId="demo" />
        )}
      </div>
    </div>
  )
}
