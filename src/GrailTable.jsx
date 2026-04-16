import React, { useState, useCallback } from 'react'

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg:        '#0a0a0a',
  surface:   '#111111',
  card:      '#161616',
  border:    '#222222',
  borderAlt: '#2a1a00',
  gold:      '#c8922a',
  goldLight: '#e8b84b',
  goldDim:   '#7a5518',
  amber:     '#d97316',
  green:     '#22c55e',
  greenDim:  '#14532d',
  red:       '#ef4444',
  redDim:    '#7f1d1d',
  text:      '#e8e0d0',
  textMid:   '#a09080',
  textDim:   '#5a5040',
}

const s = {
  page: {
    minHeight: '100vh',
    background: C.bg,
    color: C.text,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    paddingBottom: '120px',
  },
  header: {
    borderBottom: `1px solid ${C.border}`,
    padding: '1.25rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    background: C.bg,
    zIndex: 10,
  },
  section: {
    margin: '0 auto',
    maxWidth: '720px',
    padding: '0 1rem',
  },
  card: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: '12px',
    marginBottom: '1rem',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '0.85rem 1.1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1px solid ${C.border}`,
    cursor: 'pointer',
    userSelect: 'none',
  },
  cardBody: { padding: '1rem 1.1rem' },
  label: { fontSize: '0.7rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' },
  input: {
    background: '#1a1a1a',
    border: `1px solid ${C.border}`,
    borderRadius: '6px',
    color: C.text,
    padding: '0.5rem 0.7rem',
    fontSize: '0.9rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  btn: (variant = 'default') => ({
    padding: '0.5rem 1rem',
    borderRadius: '7px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: '600',
    ...(variant === 'ghost'  && { background: 'transparent', color: C.textMid, border: `1px solid ${C.border}` }),
    ...(variant === 'gold'   && { background: C.gold, color: '#000' }),
    ...(variant === 'green'  && { background: C.green, color: '#000' }),
    ...(variant === 'red'    && { background: C.red, color: '#fff' }),
    ...(variant === 'dim'    && { background: '#222', color: C.textMid }),
    ...(variant === 'default'&& { background: '#222', color: C.text, border: `1px solid ${C.border}` }),
  }),
  row: { display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.6rem' },
  pill: (color) => ({
    fontSize: '0.7rem',
    padding: '0.2rem 0.55rem',
    borderRadius: '99px',
    fontWeight: '600',
    background: color === 'gold' ? C.goldDim : color === 'green' ? C.greenDim : C.redDim,
    color: color === 'gold' ? C.goldLight : color === 'green' ? C.green : C.red,
  }),
}

// ─── DEFAULT CONTRACT STATE ────────────────────────────────────────────────────
const defaultContract = {
  eventName: 'Sunrise at Juarez',
  eventDate: '',
  capacity: 300,
  currency: 'MXN',
  producers: [
    { id: 1, name: 'JP', role: 'Promoter', greenlighted: false },
    { id: 2, name: 'Maddox', role: 'Venue', greenlighted: false },
  ],
  revenue: {
    tickets: [
      { id: 1, tier: 'Early Bird', qty: 50,  price: 200, sold: 0 },
      { id: 2, tier: 'General',   qty: 200, price: 300, sold: 0 },
      { id: 3, tier: 'Door',      qty: 50,  price: 400, sold: 0 },
    ],
    barPct: 30,   // % of bar revenue shared with producers
    sponsorTotal: 0,
  },
  costs: {
    fixed: [
      { id: 1, name: 'DJ Fee',    amount: 8000,  paidBy: 'JP',     recoup: 'first' },
      { id: 2, name: 'Sound',     amount: 5000,  paidBy: 'Maddox', recoup: 'first' },
    ],
    variable: [
      { id: 1, name: 'Security',  amount: 2000,  paidBy: 'JP',     recoup: 'first' },
    ],
    inventory: [
      { id: 1, name: 'Cups',      qty: 500, unitCost: 3,   rule: 'sold' },
      { id: 2, name: 'Ice',       qty: 20,  unitCost: 80,  rule: 'consumed' },
    ],
  },
  contributions: [
    { id: 1, name: 'JP',    type: 'Promotion',  weight: 40 },
    { id: 2, name: 'Maddox',type: 'Venue + Ops', weight: 60 },
  ],
  split: {
    mode: 'waterfall',  // 'simple' | 'waterfall'
    simpleRules: [
      { id: 1, name: 'JP',    pct: 50 },
      { id: 2, name: 'Maddox',pct: 50 },
    ],
  },
  status: 'draft',   // draft | greenlighted | live | settled
  proposedChanges: [],
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function fmt(n, currency = 'MXN') {
  return `$${Math.round(n).toLocaleString()} ${currency}`
}

function calcProjections(contract, overrides = {}) {
  const ticketPct  = overrides.ticketPct  ?? 1
  const barPct     = overrides.barPct     ?? 0.5
  const extraCosts = overrides.extraCosts ?? 0

  // Revenue
  const ticketRevenue = contract.revenue.tickets.reduce((sum, t) =>
    sum + t.qty * t.price * ticketPct, 0)
  const barRevenue = ticketRevenue * 0.3 * barPct   // rough bar assumption
  const barProducerShare = barRevenue * (contract.revenue.barPct / 100)
  const sponsorRevenue = contract.revenue.sponsorTotal
  const totalRevenue = ticketRevenue + barProducerShare + sponsorRevenue

  // Costs
  const fixedCosts    = contract.costs.fixed.reduce((s, c) => s + Number(c.amount), 0)
  const varCosts      = contract.costs.variable.reduce((s, c) => s + Number(c.amount), 0)
  const invCosts      = contract.costs.inventory.reduce((s, i) =>
    s + i.qty * i.unitCost * (i.rule === 'sold' ? barPct : 1), 0)
  const totalCosts    = fixedCosts + varCosts + invCosts + Number(extraCosts)

  const profit = totalRevenue - totalCosts

  // Waterfall split
  const totalWeight = contract.contributions.reduce((s, c) => s + Number(c.weight), 0)
  const shares = contract.split.mode === 'waterfall'
    ? contract.contributions.map(c => ({
        name: c.name,
        amount: profit > 0 ? (profit * c.weight / totalWeight) : 0,
      }))
    : contract.split.simpleRules.map(r => ({
        name: r.name,
        amount: profit > 0 ? (profit * r.pct / 100) : 0,
      }))

  return { ticketRevenue, barRevenue, barProducerShare, sponsorRevenue, totalRevenue,
           fixedCosts, varCosts, invCosts, totalCosts, profit, shares }
}

// ─── SECTION COMPONENTS ───────────────────────────────────────────────────────
function CollapsibleCard({ title, badge, badgeColor, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={s.card}>
      <div style={s.cardHeader} onClick={() => setOpen(o => !o)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ color: C.goldLight, fontWeight: '700', fontSize: '0.9rem' }}>{title}</span>
          {badge && <span style={s.pill(badgeColor || 'gold')}>{badge}</span>}
        </div>
        <span style={{ color: C.textDim, fontSize: '0.8rem' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div style={s.cardBody}>{children}</div>}
    </div>
  )
}

// ── TABLE STYLES ── used for tickets / costs / inventory sections
// <table> with tableLayout:fixed is the only 100%-reliable column alignment
const tbl = {
  width: '100%',
  tableLayout: 'fixed',
  borderCollapse: 'separate',
  borderSpacing: '0 0.35rem',
}
const tHead = {
  fontSize: '0.63rem',
  color: '#5a5040',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontWeight: '400',
  paddingBottom: '0.1rem',
  textAlign: 'left',
  borderBottom: '1px solid #222',
}
const tCell = {
  background: '#1a1a1a',
  padding: '0.4rem 0.6rem',
  borderTop: '1px solid #222',
  borderBottom: '1px solid #222',
  verticalAlign: 'middle',
  fontSize: '0.88rem',
  color: '#e8e0d0',
}
const tCellFirst = { ...tCell, borderLeft: '1px solid #222', borderRadius: '6px 0 0 6px' }
const tCellLast  = { ...tCell, borderRight: '1px solid #222', borderRadius: '0 6px 6px 0', textAlign: 'center', width: '32px' }
const tInp = {
  background: 'transparent',
  border: 'none',
  outline: 'none',
  width: '100%',
  fontSize: '0.88rem',
  color: '#e8e0d0',
  padding: 0,
}
const tInpR = { ...tInp, textAlign: 'right' }
const rmBtn = { background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.1rem 0.3rem', fontSize: '0.9rem' }

// ─── WHAT IF ENGINE ────────────────────────────────────────────────────────────
function WhatIfEngine({ contract }) {
  const [ticketPct,  setTicketPct]  = useState(80)
  const [barPct,     setBarPct]     = useState(50)
  const [extraCosts, setExtraCosts] = useState(0)

  const proj = calcProjections(contract, {
    ticketPct:  ticketPct  / 100,
    barPct:     barPct     / 100,
    extraCosts,
  })

  const profitColor = proj.profit > 0 ? C.green : C.red

  return (
    <div style={{ ...s.card, border: `1px solid ${C.goldDim}`, marginTop: '1.5rem' }}>
      <div style={{ ...s.cardHeader, cursor: 'default', borderColor: C.goldDim }}>
        <span style={{ color: C.goldLight, fontWeight: '700', fontSize: '0.9rem' }}>What If? Engine</span>
        <span style={s.pill('gold')}>LIVE SIM</span>
      </div>
      <div style={s.cardBody}>
        {/* Sliders */}
        {[
          { label: 'Ticket Sales', val: ticketPct, set: setTicketPct, unit: '%', max: 100 },
          { label: 'Bar Performance', val: barPct, set: setBarPct, unit: '%', max: 100 },
          { label: 'Extra Costs', val: extraCosts, set: setExtraCosts, unit: 'MXN', max: 20000, step: 500 },
        ].map(({ label, val, set, unit, max, step = 1 }) => (
          <div key={label} style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
              <span style={s.label}>{label}</span>
              <span style={{ color: C.goldLight, fontSize: '0.85rem', fontWeight: '600' }}>
                {unit === '%' ? `${val}%` : fmt(val)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={max}
              step={step}
              value={val}
              onChange={e => set(Number(e.target.value))}
              style={{ width: '100%', accentColor: C.gold }}
            />
          </div>
        ))}

        {/* Output */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.5rem' }}>
          {[
            { label: 'Ticket Revenue', val: proj.ticketRevenue, color: C.text },
            { label: 'Bar (Producer %)', val: proj.barProducerShare, color: C.text },
            { label: 'Total Costs', val: proj.totalCosts, color: C.red },
            { label: 'Net Profit', val: proj.profit, color: profitColor, large: true },
          ].map(({ label, val, color, large }) => (
            <div key={label} style={{
              background: '#1a1a1a',
              borderRadius: '8px',
              padding: '0.7rem 0.9rem',
              border: `1px solid ${C.border}`,
            }}>
              <div style={s.label}>{label}</div>
              <div style={{ color, fontSize: large ? '1.2rem' : '0.95rem', fontWeight: '700' }}>
                {fmt(val)}
              </div>
            </div>
          ))}
        </div>

        {/* Per-producer breakdown */}
        {proj.profit > 0 && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${C.border}` }}>
            <div style={{ ...s.label, marginBottom: '0.5rem' }}>If we hit this — you get</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {proj.shares.map(sh => (
                <div key={sh.name} style={{
                  flex: 1,
                  minWidth: '120px',
                  background: '#1a1a1a',
                  border: `1px solid ${C.greenDim}`,
                  borderRadius: '8px',
                  padding: '0.7rem 0.9rem',
                }}>
                  <div style={s.label}>{sh.name}</div>
                  <div style={{ color: C.green, fontSize: '1.1rem', fontWeight: '700' }}>{fmt(sh.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PROPOSE CHANGE MODAL ──────────────────────────────────────────────────────
function ProposeChangeModal({ contract, onClose, onSubmit }) {
  const [form, setForm] = useState({ request: '', category: 'guest-list', impact: '' })

  const proj      = calcProjections(contract)
  const impactNum = Number(form.impact) || 0
  const newProfit = proj.profit - impactNum

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: '1rem',
    }}>
      <div style={{
        background: C.card,
        border: `1px solid ${C.goldDim}`,
        borderRadius: '16px',
        padding: '1.5rem',
        maxWidth: '440px',
        width: '100%',
      }}>
        <div style={{ color: C.goldLight, fontWeight: '700', fontSize: '1rem', marginBottom: '0.3rem' }}>
          Propose a Change
        </div>
        <div style={{ color: C.textMid, fontSize: '0.8rem', marginBottom: '1.2rem' }}>
          All producers will be notified and must approve.
        </div>

        <div style={{ marginBottom: '0.7rem' }}>
          <div style={s.label}>What are you requesting?</div>
          <input
            style={s.input}
            placeholder="e.g. +20 guest list spots for DJ crew"
            value={form.request}
            onChange={e => setForm(f => ({ ...f, request: e.target.value }))}
          />
        </div>

        <div style={{ marginBottom: '0.7rem' }}>
          <div style={s.label}>Category</div>
          <select style={s.input} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            <option value="guest-list">Guest List (comped tickets)</option>
            <option value="cost-add">Additional Cost</option>
            <option value="revenue-change">Revenue Change</option>
            <option value="split-change">Split Change</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={s.label}>Revenue / Cost Impact (MXN)</div>
          <input
            style={s.input}
            type="number"
            placeholder="0 = no financial impact"
            value={form.impact}
            onChange={e => setForm(f => ({ ...f, impact: e.target.value }))}
          />
        </div>

        {impactNum !== 0 && (
          <div style={{
            background: '#1a1a1a',
            border: `1px solid ${C.border}`,
            borderRadius: '8px',
            padding: '0.7rem',
            marginBottom: '1rem',
            fontSize: '0.85rem',
          }}>
            <span style={{ color: C.textMid }}>New projected profit: </span>
            <span style={{ color: newProfit > 0 ? C.green : C.red, fontWeight: '700' }}>
              {fmt(newProfit)} <span style={{ color: C.textMid }}>({impactNum > 0 ? '↓' : '↑'} {fmt(Math.abs(impactNum))})</span>
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button style={s.btn('ghost')} onClick={onClose}>Cancel</button>
          <button
            style={s.btn('gold')}
            disabled={!form.request.trim()}
            onClick={() => { onSubmit(form); onClose() }}
          >
            Send to All Producers
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SETTLEMENT SCREEN ─────────────────────────────────────────────────────────
function SettlementView({ contract, onBack }) {
  const proj = calcProjections(contract)
  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={{ ...s.btn('ghost'), padding: '0.4rem 0.8rem' }} onClick={onBack}>← Back</button>
        <span style={{ color: C.goldLight, fontWeight: '700' }}>Settlement</span>
        <span style={s.pill('green')}>FINAL</span>
      </div>
      <div style={{ ...s.section, paddingTop: '1.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ color: C.textMid, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>
            {contract.eventName}
          </div>
          <div style={{ color: proj.profit > 0 ? C.green : C.red, fontSize: '2.2rem', fontWeight: '800' }}>
            {fmt(proj.profit)}
          </div>
          <div style={{ color: C.textMid, fontSize: '0.85rem', marginTop: '0.2rem' }}>Net Profit</div>
        </div>

        <CollapsibleCard title="Revenue Breakdown">
          {[
            ['Ticket Revenue', proj.ticketRevenue],
            ['Bar (Producer %)', proj.barProducerShare],
            ['Sponsorships', proj.sponsorRevenue],
          ].map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.textMid, fontSize: '0.9rem' }}>{label}</span>
              <span style={{ color: C.text, fontWeight: '600' }}>{fmt(val)}</span>
            </div>
          ))}
        </CollapsibleCard>

        <CollapsibleCard title="Cost Breakdown">
          {[
            ['Fixed Costs', proj.fixedCosts],
            ['Variable Costs', proj.varCosts],
            ['Inventory', proj.invCosts],
          ].map(([label, val]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ color: C.textMid, fontSize: '0.9rem' }}>{label}</span>
              <span style={{ color: C.red }}>{fmt(val)}</span>
            </div>
          ))}
        </CollapsibleCard>

        <CollapsibleCard title="Distribution">
          {proj.shares.map(sh => (
            <div key={sh.name} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.7rem 0.9rem', background: '#1a1a1a', borderRadius: '8px',
              marginBottom: '0.5rem', border: `1px solid ${C.greenDim}`,
            }}>
              <span style={{ color: C.text, fontWeight: '600' }}>{sh.name}</span>
              <span style={{ color: C.green, fontSize: '1.1rem', fontWeight: '700' }}>{fmt(sh.amount)}</span>
            </div>
          ))}
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: C.textDim, textAlign: 'center' }}>
            Tap any number to see calculation trace
          </div>
        </CollapsibleCard>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function GrailTable({ sidebarOffset = 0 }) {
  const [contract, setContract] = useState(defaultContract)
  const [showPropose,    setShowPropose]    = useState(false)
  const [showSettlement, setShowSettlement] = useState(false)
  const [pendingChanges, setPendingChanges] = useState([])

  const locked    = contract.status !== 'draft'
  const allGreen  = contract.producers.every(p => p.greenlighted)
  const proj      = calcProjections(contract)

  // Generic updater helpers
  const updateRevTicket = (id, val) =>
    setContract(c => ({ ...c, revenue: { ...c.revenue,
      tickets: c.revenue.tickets.map(t => t.id === id ? val : t),
    }}))

  const addRevTicket = () =>
    setContract(c => ({ ...c, revenue: { ...c.revenue,
      tickets: [...c.revenue.tickets, {
        id: Date.now(), tier: 'New Tier', qty: 50, price: 200, sold: 0,
      }],
    }}))

  const removeRevTicket = id =>
    setContract(c => ({ ...c, revenue: { ...c.revenue,
      tickets: c.revenue.tickets.filter(t => t.id !== id),
    }}))

  const updateCostItem = (bucket, id, val) =>
    setContract(c => ({ ...c, costs: { ...c.costs,
      [bucket]: c.costs[bucket].map(i => i.id === id ? val : i),
    }}))

  const addCostItem = (bucket) =>
    setContract(c => ({ ...c, costs: { ...c.costs,
      [bucket]: [...c.costs[bucket], {
        id: Date.now(), name: 'New Item', amount: 0, paidBy: '', recoup: 'first',
      }],
    }}))

  const removeCostItem = (bucket, id) =>
    setContract(c => ({ ...c, costs: { ...c.costs,
      [bucket]: c.costs[bucket].filter(i => i.id !== id),
    }}))

  const addInvItem = () =>
    setContract(c => ({ ...c, costs: { ...c.costs,
      inventory: [...c.costs.inventory, {
        id: Date.now(), name: 'New Item', qty: 0, unitCost: 0, rule: 'sold',
      }],
    }}))

  const removeInvItem = id =>
    setContract(c => ({ ...c, costs: { ...c.costs,
      inventory: c.costs.inventory.filter(i => i.id !== id),
    }}))

  const updateInvItem = (id, val) =>
    setContract(c => ({ ...c, costs: { ...c.costs,
      inventory: c.costs.inventory.map(i => i.id === id ? val : i),
    }}))

  const greenlight = (producerId) =>
    setContract(c => {
      const updated = { ...c, producers: c.producers.map(p =>
        p.id === producerId ? { ...p, greenlighted: true } : p
      )}
      const allDone = updated.producers.every(p => p.greenlighted)
      return { ...updated, status: allDone ? 'greenlighted' : c.status }
    })

  const handleProposedChange = (change) => {
    setPendingChanges(pc => [...pc, {
      ...change, id: Date.now(), status: 'pending', createdAt: new Date().toISOString(),
    }])
    // TODO: POST to Supabase grail_proposed_changes + push notification to all producers
  }

  if (showSettlement) {
    return <SettlementView contract={contract} onBack={() => setShowSettlement(false)} />
  }

  return (
    <div style={s.page}>
      {/* ── HEADER ── */}
      <div style={s.header}>
        <div>
          <div style={{ color: C.goldLight, fontWeight: '800', fontSize: '1rem' }}>
            {contract.eventName || 'Untitled Event'}
          </div>
          <div style={{ color: C.textMid, fontSize: '0.75rem' }}>{contract.eventDate || 'Date TBD'}</div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={s.pill(allGreen ? 'green' : 'gold')}>
            {allGreen ? 'LOCKED' : 'DRAFT'}
          </span>
          <button style={s.btn('dim')} onClick={() => setShowPropose(true)}>Propose Change</button>
          {allGreen && (
            <button style={s.btn('dim')} onClick={() => setShowSettlement(true)}>Settlement</button>
          )}
        </div>
      </div>

      <div style={{ ...s.section, paddingTop: '1.25rem' }}>

        {/* ── GREENLIGHT PANEL ── */}
        <div style={{
          background: allGreen ? '#061a0e' : C.card,
          border: `1px solid ${allGreen ? C.green : C.border}`,
          borderRadius: '12px',
          marginBottom: '1rem',
          overflow: 'hidden',
          transition: 'border-color 0.3s',
        }}>
          {/* Panel header */}
          <div style={{
            padding: '0.75rem 1.1rem',
            borderBottom: `1px solid ${allGreen ? C.greenDim : C.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: allGreen ? C.green : C.goldLight }}>
                {allGreen ? '✓ Contract Locked' : 'Greenlight Required'}
              </span>
              {!allGreen && (
                <span style={{ fontSize: '0.7rem', color: C.textMid }}>
                  — all producers must sign before this goes live
                </span>
              )}
            </div>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: '700',
              padding: '0.15rem 0.55rem',
              borderRadius: '99px',
              background: allGreen ? C.greenDim : '#1a1a00',
              color: allGreen ? C.green : C.goldLight,
            }}>
              {contract.producers.filter(p => p.greenlighted).length} / {contract.producers.length}
            </span>
          </div>

          {/* Producer signature rows */}
          <div style={{ padding: '0.75rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {contract.producers.map(p => (
              <div key={p.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: p.greenlighted ? '#0a2010' : '#1a1a1a',
                border: `1px solid ${p.greenlighted ? C.greenDim : C.border}`,
                borderRadius: '8px',
                padding: '0.65rem 0.9rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{
                    width: '9px', height: '9px', borderRadius: '50%',
                    background: p.greenlighted ? C.green : C.textDim,
                    flexShrink: 0,
                  }} />
                  <div>
                    <span style={{ color: C.text, fontSize: '0.88rem', fontWeight: '600' }}>{p.name}</span>
                    <span style={{ color: C.textMid, fontSize: '0.75rem', marginLeft: '0.5rem' }}>{p.role}</span>
                  </div>
                </div>
                {p.greenlighted ? (
                  <span style={{ color: C.green, fontSize: '0.8rem', fontWeight: '700' }}>SIGNED ✓</span>
                ) : (
                  <button
                    style={{
                      background: C.greenDim,
                      border: `1px solid ${C.green}`,
                      color: C.green,
                      borderRadius: '6px',
                      padding: '0.35rem 0.85rem',
                      fontSize: '0.78rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      letterSpacing: '0.05em',
                    }}
                    onClick={() => greenlight(p.id)}
                  >
                    GREENLIGHT
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* All-signed footer */}
          {allGreen && (
            <div style={{
              padding: '0.7rem 1.1rem',
              borderTop: `1px solid ${C.greenDim}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ color: C.green, fontSize: '0.82rem' }}>
                This contract is law. Fields are now locked.
              </span>
              <span style={{ color: C.textDim, fontSize: '0.72rem' }}>v1.0</span>
            </div>
          )}
        </div>

        {/* ── PENDING CHANGES ── */}
        {pendingChanges.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            {pendingChanges.filter(c => c.status === 'pending').map(ch => (
              <div key={ch.id} style={{
                background: '#1a0d00',
                border: `1px solid ${C.amber}`,
                borderRadius: '8px',
                padding: '0.7rem 1rem',
                marginBottom: '0.4rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <span style={{ color: C.amber, fontSize: '0.75rem', fontWeight: '700' }}>PROPOSED CHANGE</span>
                  <div style={{ color: C.text, fontSize: '0.85rem' }}>{ch.request}</div>
                  {ch.impact && Number(ch.impact) !== 0 && (
                    <div style={{ color: C.textMid, fontSize: '0.75rem' }}>
                      Impact: {fmt(Number(ch.impact))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button style={{ ...s.btn('ghost'), padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: C.green, borderColor: C.greenDim }}
                    onClick={() => setPendingChanges(pc => pc.map(c => c.id === ch.id ? { ...c, status: 'approved' } : c))}>
                    Approve
                  </button>
                  <button style={{ ...s.btn('ghost'), padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: C.red, borderColor: C.redDim }}
                    onClick={() => setPendingChanges(pc => pc.filter(c => c.id !== ch.id))}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── A. REVENUE ── */}
        <CollapsibleCard
          title="A. Revenue Streams"
          badge={fmt(proj.totalRevenue)}
          badgeColor="gold"
        >
          <div style={{ ...s.label, marginBottom: '0.25rem' }}>TICKETS</div>
          <table style={tbl}>
            <colgroup>
              <col /><col style={{ width: '70px' }} /><col style={{ width: '80px' }} /><col style={{ width: '90px' }} /><col style={{ width: '32px' }} />
            </colgroup>
            <thead>
              <tr>
                {['Tier','Qty','Price','Total',''].map((h,i) => (
                  <th key={i} style={{ ...tHead, textAlign: i >= 1 && i <= 3 ? 'right' : 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contract.revenue.tickets.map(t => (
                <tr key={t.id}>
                  <td style={tCellFirst}>
                    <input style={tInp} value={t.tier} disabled={locked} placeholder="Tier name"
                      onChange={e => updateRevTicket(t.id, { ...t, tier: e.target.value })} />
                  </td>
                  <td style={{ ...tCell, textAlign: 'right' }}>
                    <input style={tInpR} type="number" value={t.qty} disabled={locked}
                      onChange={e => updateRevTicket(t.id, { ...t, qty: Number(e.target.value) })} />
                  </td>
                  <td style={{ ...tCell, textAlign: 'right' }}>
                    <input style={tInpR} type="number" value={t.price} disabled={locked}
                      onChange={e => updateRevTicket(t.id, { ...t, price: Number(e.target.value) })} />
                  </td>
                  <td style={{ ...tCell, textAlign: 'right', color: C.goldLight, fontWeight: '600' }}>
                    ${Math.round(t.qty * t.price).toLocaleString()}
                  </td>
                  <td style={tCellLast}>
                    {!locked && <button style={rmBtn} onClick={() => removeRevTicket(t.id)}>✕</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!locked && (
            <button style={{ ...s.btn('ghost'), fontSize: '0.8rem', width: '100%', marginTop: '0.25rem' }} onClick={addRevTicket}>+ Add Tier</button>
          )}

          <div style={{ marginTop: '1rem', paddingTop: '0.8rem', borderTop: `1px solid ${C.border}` }}>
            <div style={{ ...s.label, marginBottom: '0.4rem' }}>BAR</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: C.textMid, fontSize: '0.8rem' }}>Producers receive</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  type="number"
                  min={0} max={100}
                  style={{ ...s.input, width: '70px', textAlign: 'center' }}
                  value={contract.revenue.barPct}
                  disabled={locked}
                  onChange={e => setContract(c => ({ ...c, revenue: { ...c.revenue, barPct: Number(e.target.value) } }))}
                />
                <span style={{ color: C.textMid, fontSize: '0.85rem' }}>% of bar revenue</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: `1px solid ${C.border}` }}>
            <div style={{ ...s.label, marginBottom: '0.4rem' }}>SPONSORS / OTHER</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input
                type="number"
                style={{ ...s.input, flex: 1 }}
                value={contract.revenue.sponsorTotal}
                disabled={locked}
                placeholder="0"
                onChange={e => setContract(c => ({ ...c, revenue: { ...c.revenue, sponsorTotal: Number(e.target.value) } }))}
              />
              <span style={{ color: C.textMid, fontSize: '0.85rem' }}>MXN</span>
            </div>
          </div>
        </CollapsibleCard>

        {/* ── B. COSTS ── */}
        <CollapsibleCard
          title="B. Costs"
          badge={fmt(proj.totalCosts)}
          badgeColor="gold"
        >
          {[
            { key: 'fixed', label: 'Fixed (DJ, Venue, Sound)' },
            { key: 'variable', label: 'Variable (Staff, Security)' },
          ].map(({ key, label }) => (
            <div key={key} style={{ marginBottom: '1rem' }}>
              <div style={s.label}>{label}</div>
              <table style={tbl}>
                <colgroup>
                  <col /><col style={{ width: '100px' }} /><col style={{ width: '90px' }} /><col style={{ width: '32px' }} />
                </colgroup>
                <thead>
                  <tr>
                    {[['Name','left'],['Amount','right'],['Paid by','left'],['','left']].map(([h,a]) => (
                      <th key={h} style={{ ...tHead, textAlign: a }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contract.costs[key].map(item => (
                    <tr key={item.id}>
                      <td style={tCellFirst}>
                        <input style={tInp} value={item.name} disabled={locked} placeholder="Item name"
                          onChange={e => updateCostItem(key, item.id, { ...item, name: e.target.value })} />
                      </td>
                      <td style={{ ...tCell, textAlign: 'right' }}>
                        <input style={tInpR} type="number" value={item.amount} disabled={locked}
                          onChange={e => updateCostItem(key, item.id, { ...item, amount: Number(e.target.value) })} />
                      </td>
                      <td style={tCell}>
                        <input style={tInp} value={item.paidBy} disabled={locked} placeholder="Who"
                          onChange={e => updateCostItem(key, item.id, { ...item, paidBy: e.target.value })} />
                      </td>
                      <td style={tCellLast}>
                        {!locked && <button style={rmBtn} onClick={() => removeCostItem(key, item.id)}>✕</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!locked && (
                <button style={{ ...s.btn('ghost'), fontSize: '0.8rem', width: '100%', marginTop: '0.25rem' }} onClick={() => addCostItem(key)}>
                  + Add {key} cost
                </button>
              )}
            </div>
          ))}

          <div style={{ marginTop: '0.5rem', paddingTop: '0.8rem', borderTop: `1px solid ${C.border}` }}>
            <div style={s.label}>INVENTORY (cups, alcohol, wristbands…)</div>
            <table style={tbl}>
              <colgroup>
                <col /><col style={{ width: '60px' }} /><col style={{ width: '70px' }} /><col style={{ width: '110px' }} /><col style={{ width: '32px' }} />
              </colgroup>
              <thead>
                <tr>
                  {[['Item','left'],['Qty','right'],['Unit $','right'],['Rule','left'],['','left']].map(([h,a]) => (
                    <th key={h} style={{ ...tHead, textAlign: a }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contract.costs.inventory.map(item => (
                  <tr key={item.id}>
                    <td style={tCellFirst}>
                      <input style={tInp} value={item.name} disabled={locked} placeholder="Item"
                        onChange={e => updateInvItem(item.id, { ...item, name: e.target.value })} />
                    </td>
                    <td style={{ ...tCell, textAlign: 'right' }}>
                      <input style={tInpR} type="number" value={item.qty} disabled={locked}
                        onChange={e => updateInvItem(item.id, { ...item, qty: Number(e.target.value) })} />
                    </td>
                    <td style={{ ...tCell, textAlign: 'right' }}>
                      <input style={tInpR} type="number" value={item.unitCost} disabled={locked}
                        onChange={e => updateInvItem(item.id, { ...item, unitCost: Number(e.target.value) })} />
                    </td>
                    <td style={tCell}>
                      <select style={{ ...tInp, cursor: 'pointer' }} value={item.rule} disabled={locked}
                        onChange={e => updateInvItem(item.id, { ...item, rule: e.target.value })}>
                        <option value="sold">Sold only</option>
                        <option value="consumed">All consumed</option>
                        <option value="free">Free / gift</option>
                      </select>
                    </td>
                    <td style={tCellLast}>
                      {!locked && <button style={rmBtn} onClick={() => removeInvItem(item.id)}>✕</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!locked && (
              <button style={{ ...s.btn('ghost'), fontSize: '0.8rem', width: '100%', marginTop: '0.25rem' }} onClick={addInvItem}>
                + Add inventory item
              </button>
            )}
            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: C.textMid }}>
              Unused inventory ≠ expense — only consumed / sold items count.
            </div>
          </div>
        </CollapsibleCard>

        {/* ── C. CONTRIBUTIONS ── */}
        <CollapsibleCard title="C. Non-Cash Contributions">
          {contract.contributions.map(c => (
            <div key={c.id} style={{ ...s.row, background: '#1a1a1a', borderRadius: '8px', padding: '0.5rem 0.7rem', marginBottom: '0.4rem' }}>
              <input
                style={{ ...s.input, flex: 2, marginBottom: 0 }}
                value={c.name}
                disabled={locked}
                onChange={e => setContract(cont => ({ ...cont, contributions: cont.contributions.map(x => x.id === c.id ? { ...x, name: e.target.value } : x) }))}
              />
              <input
                style={{ ...s.input, flex: 2, marginBottom: 0 }}
                value={c.type}
                disabled={locked}
                placeholder="Type (Promotion, Ops…)"
                onChange={e => setContract(cont => ({ ...cont, contributions: cont.contributions.map(x => x.id === c.id ? { ...x, type: e.target.value } : x) }))}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  type="number"
                  style={{ ...s.input, width: '60px', textAlign: 'center', marginBottom: 0 }}
                  value={c.weight}
                  disabled={locked}
                  min={0}
                  max={100}
                  onChange={e => setContract(cont => ({ ...cont, contributions: cont.contributions.map(x => x.id === c.id ? { ...x, weight: Number(e.target.value) } : x) }))}
                />
                <span style={{ color: C.textMid, fontSize: '0.8rem' }}>pts</span>
              </div>
            </div>
          ))}
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: C.textMid }}>
            Points drive the waterfall split. Everyone's contribution is visible and agreed.
          </div>
        </CollapsibleCard>

        {/* ── D. SPLIT ENGINE ── */}
        <CollapsibleCard title="D. Split Engine">
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {['waterfall', 'simple'].map(mode => (
              <button key={mode} style={{
                ...s.btn(contract.split.mode === mode ? 'gold' : 'ghost'),
                flex: 1,
                textTransform: 'capitalize',
              }}
              disabled={locked}
              onClick={() => setContract(c => ({ ...c, split: { ...c.split, mode } }))}>
                {mode === 'waterfall' ? 'Waterfall (by contribution weight)' : 'Simple (% split)'}
              </button>
            ))}
          </div>

          {contract.split.mode === 'simple' && (
            <>
              {contract.split.simpleRules.map(r => (
                <div key={r.id} style={{ ...s.row, background: '#1a1a1a', borderRadius: '8px', padding: '0.5rem 0.7rem', marginBottom: '0.4rem' }}>
                  <input
                    style={{ ...s.input, flex: 2, marginBottom: 0 }}
                    value={r.name}
                    disabled={locked}
                    onChange={e => setContract(c => ({ ...c, split: { ...c.split, simpleRules: c.split.simpleRules.map(x => x.id === r.id ? { ...x, name: e.target.value } : x) }}))}
                  />
                  <input
                    type="number"
                    style={{ ...s.input, flex: 1, marginBottom: 0, textAlign: 'right' }}
                    value={r.pct}
                    disabled={locked}
                    min={0} max={100}
                    onChange={e => setContract(c => ({ ...c, split: { ...c.split, simpleRules: c.split.simpleRules.map(x => x.id === r.id ? { ...x, pct: Number(e.target.value) } : x) }}))}
                  />
                  <span style={{ color: C.textMid }}>%</span>
                </div>
              ))}
            </>
          )}

          {contract.split.mode === 'waterfall' && (
            <div style={{ color: C.textMid, fontSize: '0.85rem' }}>
              Split driven by contribution weights above.
              {' '}
              {contract.contributions.map(c => (
                <span key={c.id}>
                  <strong style={{ color: C.text }}>{c.name}</strong>: {c.weight} pts{' '}
                </span>
              ))}
              → see What If? for projections.
            </div>
          )}
        </CollapsibleCard>

        {/* ── WHAT IF ENGINE ── */}
        <WhatIfEngine contract={contract} />

      </div>

      {/* ── STICKY FOOTER ── */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: sidebarOffset, right: 0,
        background: C.surface,
        borderTop: `1px solid ${locked ? C.greenDim : C.border}`,
        padding: '0.8rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
      }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: C.textMid }}>PROJECTED PROFIT</div>
          <div style={{ color: proj.profit > 0 ? C.green : C.red, fontWeight: '700', fontSize: '1.1rem' }}>
            {fmt(proj.profit)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {!locked && (
            <button style={s.btn('ghost')} onClick={() => setShowPropose(true)}>
              Propose Change
            </button>
          )}
          {locked && (
            <button style={s.btn('green')} onClick={() => setShowSettlement(true)}>
              Settlement →
            </button>
          )}
          {!locked && !allGreen && (
            <div style={{ color: C.textDim, fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
              {contract.producers.filter(p => !p.greenlighted).length} producer{contract.producers.filter(p => !p.greenlighted).length > 1 ? 's' : ''} haven't greenlighted
            </div>
          )}
        </div>
      </div>

      {/* ── MODALS ── */}
      {showPropose && (
        <ProposeChangeModal
          contract={contract}
          onClose={() => setShowPropose(false)}
          onSubmit={handleProposedChange}
        />
      )}
    </div>
  )
}
