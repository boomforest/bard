import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useT } from './i18n'

// ─── BRAND ────────────────────────────────────────────────────────────────────
const BRAND = {
  name:     'The Rooftop',
  handle:   '@grail',
  city:     'Atlanta, GA',
  genre:    'House / Techno',
  website:  'grail.mx',
  gradient:      'linear-gradient(135deg, #dd22aa 0%, #f07020 100%)',
  gradientAngle: 'linear-gradient(160deg, #dd22aa, #f07020)',
  pink:    '#dd22aa',
  orange:  '#f07020',
  neon:    '#aaff00',
}

// ─── COLORS ───────────────────────────────────────────────────────────────────
const C = {
  bg:      '#08080c',
  surface: '#0e0e14',
  card:    '#12121a',
  border:  '#1e1e2a',
  text:    '#e8e0d0',
  textMid: '#8a8098',
  textDim: '#3a3448',
  green:   '#22c55e',
  red:     '#ef4444',
}

// ─── GRAIL LOGO ───────────────────────────────────────────────────────────────
function AlleycatLogo({ size = 80 }) {
  const fontSize = size * 0.28
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #dd22aa, #f07020)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <span style={{ color: '#fff', fontWeight: '900', fontSize, letterSpacing: '-0.02em', fontFamily: 'system-ui, sans-serif' }}>
        GRAIL
      </span>
    </div>
  )
}

// ─── EVENT CONFIG ─────────────────────────────────────────────────────────────
const EVENT = {
  name:     'Rooftop Party',
  date:     'May 2, 2026',
  venue:    'Atlanta Rooftop',
  city:     'Atlanta, GA',
  capacity: 300,
  currency: 'USD',
  tickets: [
    { tier: 'Early Bird', qty: 60,  price: 15 },
    { tier: 'General',    qty: 180, price: 25 },
    { tier: 'Door',       qty: 60,  price: 35 },
  ],
  costs: {
    dj:      800,
    sound:   600,
    security:350,
    venue:   500,
  },
  barPct:  25,
  producers: [
    { name: 'Promoter',     role: 'Promoter',     split: 60 },
    { name: 'The Rooftop',  role: 'Venue',         split: 40 },
  ],
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function fmt(n) {
  return `$${Math.round(n).toLocaleString()}`
}

function calcEvent(ticketPct, barPct, extraCost) {
  const ticketRev = EVENT.tickets.reduce((s, t) => s + t.qty * t.price * ticketPct, 0)
  const barRev    = ticketRev * 0.35 * barPct   // rough bar multiplier
  const barCut    = barRev * (EVENT.barPct / 100)
  const totalRev  = ticketRev + barCut
  const totalCost = Object.values(EVENT.costs).reduce((s, c) => s + c, 0) + extraCost
  const profit    = totalRev - totalCost
  const shares    = EVENT.producers.map(p => ({
    name: p.name,
    amount: profit > 0 ? profit * p.split / 100 : 0,
  }))
  return { ticketRev, barCut, totalRev, totalCost, profit, shares }
}

// ─── SECTION WRAPPER ──────────────────────────────────────────────────────────
function Section({ children, style = {} }) {
  return (
    <div style={{
      maxWidth: '860px',
      margin: '0 auto',
      padding: '0 1.5rem',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ─── WHAT IF ENGINE (inline, Alleycat-branded) ────────────────────────────────
function WhatIfBlock() {
  const t = useT()
  const [ticketPct, setTicketPct] = useState(75)
  const [barPct,    setBarPct]    = useState(50)
  const [extraCost, setExtraCost] = useState(0)

  const result = calcEvent(ticketPct / 100, barPct / 100, extraCost)
  const profitColor = result.profit > 0 ? '#22c55e' : '#ef4444'

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: '16px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 1.4rem',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ color: C.text, fontWeight: '800', fontSize: '0.95rem' }}>{t('demo.whatIf.title')}</div>
          <div style={{ color: C.textMid, fontSize: '0.75rem' }}>{EVENT.name} · {EVENT.venue}</div>
        </div>
        <div style={{
          fontSize: '0.68rem',
          padding: '0.2rem 0.6rem',
          borderRadius: '99px',
          background: '#1a1a2a',
          border: `1px solid ${C.border}`,
          color: BRAND.orange,
          fontWeight: '700',
          letterSpacing: '0.06em',
        }}>
          {t('demo.whatIf.live')}
        </div>
      </div>

      <div style={{ padding: '1.4rem' }}>
        {/* Sliders */}
        {[
          { label: t('demo.whatIf.ticketSales'), val: ticketPct, set: setTicketPct, display: t('demo.whatIf.ticketsCount', { pct: ticketPct, n: Math.round(EVENT.tickets.reduce((s,t)=>s+t.qty,0)*ticketPct/100) }), max: 100 },
          { label: t('demo.whatIf.barPerf'),     val: barPct,    set: setBarPct,    display: `${barPct}%`, max: 100 },
          { label: t('demo.whatIf.extraCosts'),  val: extraCost, set: setExtraCost, display: fmt(extraCost), max: 5000, step: 100 },
        ].map(({ label, val, set, display, max, step = 1 }) => (
          <div key={label} style={{ marginBottom: '1.1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
              <span style={{ fontSize: '0.85rem', color: BRAND.orange, fontWeight: '700' }}>{display}</span>
            </div>
            <input
              type="range" min={0} max={max} step={step} value={val}
              onChange={e => set(Number(e.target.value))}
              style={{ width: '100%', accentColor: BRAND.pink }}
            />
          </div>
        ))}

        {/* Results grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem', marginTop: '0.5rem' }}>
          {[
            { label: t('demo.whatIf.ticketRev'),                              val: result.ticketRev, color: C.text },
            { label: t('demo.whatIf.barCut', { pct: EVENT.barPct }),          val: result.barCut,    color: C.text },
            { label: t('demo.whatIf.totalCosts'),                             val: result.totalCost, color: C.red },
            { label: t('demo.whatIf.netProfit'),                              val: result.profit,    color: profitColor, large: true },
          ].map(({ label, val, color, large }) => (
            <div key={label} style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: '10px',
              padding: '0.8rem 1rem',
            }}>
              <div style={{ fontSize: '0.65rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>{label}</div>
              <div style={{ color, fontSize: large ? '1.2rem' : '0.95rem', fontWeight: '800' }}>{fmt(val)}</div>
            </div>
          ))}
        </div>

        {/* Per-producer */}
        {result.profit > 0 && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: '0.68rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>
              {t('demo.whatIf.youGet')}
            </div>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              {result.shares.map(sh => (
                <div key={sh.name} style={{
                  flex: 1,
                  background: '#0d1a0d',
                  border: '1px solid #14532d',
                  borderRadius: '10px',
                  padding: '0.8rem',
                }}>
                  <div style={{ fontSize: '0.68rem', color: C.textMid, marginBottom: '0.2rem' }}>{sh.name}</div>
                  <div style={{ color: '#22c55e', fontSize: '1.1rem', fontWeight: '800' }}>{fmt(sh.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── FEATURE CARD ─────────────────────────────────────────────────────────────
function FeatureCard({ emoji, title, desc, tag }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: '14px',
      padding: '1.4rem',
    }}>
      <div style={{ fontSize: '1.8rem', marginBottom: '0.7rem' }}>{emoji}</div>
      {tag && (
        <div style={{
          display: 'inline-block',
          fontSize: '0.62rem',
          padding: '0.15rem 0.5rem',
          borderRadius: '99px',
          background: '#1a1000',
          color: BRAND.orange,
          fontWeight: '700',
          letterSpacing: '0.08em',
          marginBottom: '0.4rem',
        }}>
          {tag}
        </div>
      )}
      <div style={{ color: C.text, fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.4rem' }}>{title}</div>
      <div style={{ color: C.textMid, fontSize: '0.82rem', lineHeight: 1.5 }}>{desc}</div>
    </div>
  )
}

// ─── CONTRACT PREVIEW ─────────────────────────────────────────────────────────
function ContractPreview() {
  const t = useT()
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: '16px',
      overflow: 'hidden',
    }}>
      {/* Bar */}
      <div style={{
        padding: '0.8rem 1.2rem',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <AlleycatLogo size={28} />
          <div>
            <div style={{ color: C.text, fontWeight: '700', fontSize: '0.85rem' }}>{EVENT.name}</div>
            <div style={{ color: C.textMid, fontSize: '0.7rem' }}>{EVENT.date} · {EVENT.venue}</div>
          </div>
        </div>
        <div style={{
          fontSize: '0.65rem',
          padding: '0.18rem 0.55rem',
          borderRadius: '99px',
          background: '#1a0d00',
          border: `1px solid #6b4a14`,
          color: BRAND.orange,
          fontWeight: '700',
        }}>
          {t('demo.contract.draft')}
        </div>
      </div>

      {/* Ticket tiers */}
      <div style={{ padding: '1rem 1.2rem', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: '0.65rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>{t('demo.contract.revenue')}</div>
        {EVENT.tickets.map(t => (
          <div key={t.tier} style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.45rem 0.7rem',
            background: C.surface,
            borderRadius: '7px',
            marginBottom: '0.35rem',
          }}>
            <span style={{ flex: 1, color: C.text, fontSize: '0.85rem' }}>{t.tier}</span>
            <span style={{ flex: 1, color: C.textMid, fontSize: '0.8rem', textAlign: 'center' }}>{t.qty} × {fmt(t.price)}</span>
            <span style={{ flex: 1, color: BRAND.orange, fontWeight: '700', fontSize: '0.85rem', textAlign: 'right' }}>{fmt(t.qty * t.price)}</span>
          </div>
        ))}
      </div>

      {/* Costs */}
      <div style={{ padding: '1rem 1.2rem', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: '0.65rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>{t('demo.contract.costs')}</div>
        {[
          { name: t('demo.contract.cost.dj'),       amount: EVENT.costs.dj,       by: t('demo.contract.role.promoter') },
          { name: t('demo.contract.cost.sound'),    amount: EVENT.costs.sound,    by: t('demo.contract.role.venue') },
          { name: t('demo.contract.cost.security'), amount: EVENT.costs.security, by: t('demo.contract.role.promoter') },
          { name: t('demo.contract.cost.venue'),    amount: EVENT.costs.venue,    by: t('demo.contract.role.venue') },
        ].map(c => (
          <div key={c.name} style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.45rem 0.7rem',
            background: C.surface,
            borderRadius: '7px',
            marginBottom: '0.35rem',
          }}>
            <span style={{ flex: 1, color: C.text, fontSize: '0.85rem' }}>{c.name}</span>
            <span style={{ flex: 1, color: C.textMid, fontSize: '0.75rem', textAlign: 'center' }}>{c.by}</span>
            <span style={{ flex: 1, color: C.red, fontWeight: '600', fontSize: '0.85rem', textAlign: 'right' }}>−{fmt(c.amount)}</span>
          </div>
        ))}
      </div>

      {/* Producers + roles + greenlight */}
      <GreenlightPanel />
    </div>
  )
}

function GreenlightPanel() {
  const t = useT()
  const [signed, setSigned] = useState([false, false])
  const allSigned = signed.every(Boolean)

  const roleColors = {
    'Promoter': { bg: '#0d0820', border: '#3d1a6e', text: '#b57bff' },
    'Venue':    { bg: '#0a1200', border: '#1a3a0a', text: '#6abf4b' },
  }

  // Producer roles in EVENT use English keys for color lookup; display uses translation.
  const roleLabel = role => role === 'Promoter' ? t('demo.contract.role.promoter') : t('demo.contract.role.venue')

  return (
    <div style={{ padding: '1rem 1.2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <div style={{ fontSize: '0.65rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {t('demo.greenlight.heading')}
        </div>
        <div style={{
          fontSize: '0.65rem', fontWeight: '700', padding: '0.15rem 0.5rem', borderRadius: '99px',
          background: allSigned ? '#0a1400' : '#1a0d00',
          border: `1px solid ${allSigned ? '#2a5a1a' : '#4a2a0a'}`,
          color: allSigned ? '#6abf4b' : BRAND.orange,
        }}>
          {t('demo.greenlight.signed', { done: signed.filter(Boolean).length, total: signed.length })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginBottom: allSigned ? '0.75rem' : 0 }}>
        {EVENT.producers.map((p, i) => {
          const rc = roleColors[p.role] || roleColors['Promoter']
          return (
            <div key={p.name} style={{
              background: signed[i] ? '#0a1400' : C.surface,
              border: `1px solid ${signed[i] ? '#2a5a1a' : C.border}`,
              borderRadius: '9px',
              padding: '0.6rem 0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.7rem',
              transition: 'all 0.25s',
            }}>
              {/* Role badge */}
              <div style={{
                fontSize: '0.62rem', fontWeight: '800', padding: '0.18rem 0.5rem',
                borderRadius: '5px', background: rc.bg, border: `1px solid ${rc.border}`,
                color: rc.text, flexShrink: 0, letterSpacing: '0.04em',
              }}>
                {roleLabel(p.role).toUpperCase()}
              </div>

              {/* Name + split */}
              <div style={{ flex: 1 }}>
                <div style={{ color: C.text, fontWeight: '700', fontSize: '0.85rem' }}>{p.name}</div>
                <div style={{ color: C.textMid, fontSize: '0.7rem' }}>{t('demo.greenlight.netShare', { pct: p.split })}</div>
              </div>

              {/* Status / button */}
              {signed[i] ? (
                <div style={{ fontSize: '0.75rem', color: '#6abf4b', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {t('demo.greenlight.greenlit')}
                </div>
              ) : (
                <button
                  onClick={() => setSigned(s => { const n = [...s]; n[i] = true; return n })}
                  disabled={allSigned}
                  style={{
                    background: 'transparent', border: `1px solid ${BRAND.neon}66`,
                    color: BRAND.neon, borderRadius: '6px', padding: '0.3rem 0.75rem',
                    fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  {t('demo.greenlight.cta')}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {allSigned && (
        <div style={{
          background: '#0a1400', border: `1px solid #2a5a1a`,
          borderRadius: '8px', padding: '0.6rem 0.8rem',
          fontSize: '0.78rem', color: '#6abf4b', fontWeight: '600',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <span>🔒</span> {t('demo.greenlight.locked')}
        </div>
      )}
    </div>
  )
}

// ─── TIMELINE ─────────────────────────────────────────────────────────────────
function Timeline() {
  const t = useT()
  const steps = [
    { icon: '📋', label: t('demo.timeline.s1.label'), desc: t('demo.timeline.s1.desc') },
    { icon: '✅', label: t('demo.timeline.s2.label'), desc: t('demo.timeline.s2.desc') },
    { icon: '🌅', label: t('demo.timeline.s3.label'), desc: t('demo.timeline.s3.desc') },
    { icon: '💰', label: t('demo.timeline.s4.label'), desc: t('demo.timeline.s4.desc') },
  ]
  return (
    <div style={{ position: 'relative' }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: '1.2rem', marginBottom: '1.5rem', alignItems: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, #cc44ee22, #e8922a22)`,
            border: `1px solid #cc44ee44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem',
            flexShrink: 0,
          }}>
            {s.icon}
          </div>
          <div>
            <div style={{ color: C.text, fontWeight: '700', fontSize: '0.9rem', marginBottom: '0.2rem' }}>{s.label}</div>
            <div style={{ color: C.textMid, fontSize: '0.82rem', lineHeight: 1.5 }}>{s.desc}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── STRIPE CONNECT SECTION ───────────────────────────────────────────────────
const TICKER_SALES = [
  { name: 'Marcus T.',   tier: 'GA',  amount: 35 },
  { name: 'Priya K.',    tier: 'GA',  amount: 35 },
  { name: 'James W.',    tier: 'VIP', amount: 75 },
  { name: 'Sofia M.',    tier: 'GA',  amount: 35 },
  { name: 'Darius L.',   tier: 'VIP', amount: 75 },
  { name: 'Cleo R.',     tier: 'GA',  amount: 35 },
  { name: 'Nico B.',     tier: 'GA',  amount: 35 },
  { name: 'Aaliyah C.',  tier: 'VIP', amount: 75 },
]

function StripeConnectDemo() {
  const t = useT()
  const [connected, setConnected]   = useState(false)
  const [balance,   setBalance]     = useState(0)
  const [feed,      setFeed]        = useState([])
  const [connecting,setConnecting]  = useState(false)
  const intervalRef = useRef(null)
  const idxRef      = useRef(0)

  const startTicker = () => {
    intervalRef.current = setInterval(() => {
      const sale = TICKER_SALES[idxRef.current % TICKER_SALES.length]
      idxRef.current++
      setBalance(b => b + sale.amount)
      setFeed(f => [{ ...sale, id: Date.now() }, ...f].slice(0, 6))
    }, 1800)
  }

  const handleConnect = () => {
    setConnecting(true)
    setTimeout(() => {
      setConnecting(false)
      setConnected(true)
      setTimeout(startTicker, 600)
    }, 2000)
  }

  useEffect(() => () => clearInterval(intervalRef.current), [])

  const STEPS = [
    { n: '01', title: t('demo.money.s1.title'), body: t('demo.money.s1.body'), done: connected,                   active: !connected },
    { n: '02', title: t('demo.money.s2.title'), body: t('demo.money.s2.body'), done: connected && balance > 0,    active: connected },
    { n: '03', title: t('demo.money.s3.title'), body: t('demo.money.s3.body'), done: false,                       active: connected && balance >= 150 },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'start' }}>
      {/* Left — copy + steps */}
      <div>
        <div style={{ fontSize: '0.72rem', color: BRAND.pink, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: '700', marginBottom: '0.5rem' }}>
          {t('demo.money.eyebrow')}
        </div>
        <div style={{ fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', fontWeight: '800', marginBottom: '0.8rem', lineHeight: 1.2 }}>
          {t('demo.money.heading')}
        </div>
        <div style={{ color: C.textMid, fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          {t('demo.money.body')}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {STEPS.map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: '1rem', opacity: step.active || step.done ? 1 : 0.35, transition: 'opacity 0.4s' }}>
              <div style={{
                flexShrink: 0,
                width: '36px', height: '36px',
                borderRadius: '50%',
                border: `2px solid ${step.done ? BRAND.neon : step.active ? BRAND.orange : C.border}`,
                background: step.done ? BRAND.neon + '18' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.72rem', fontWeight: '800',
                color: step.done ? BRAND.neon : step.active ? BRAND.orange : C.textMid,
                transition: 'all 0.4s',
              }}>
                {step.done ? '✓' : step.n}
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.92rem', color: step.done ? BRAND.neon : C.text, marginBottom: '0.2rem', transition: 'color 0.4s' }}>
                  {step.title}
                </div>
                <div style={{ color: C.textMid, fontSize: '0.82rem', lineHeight: 1.5 }}>{step.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — interactive card */}
      <div style={{ background: '#0d0d14', border: `1px solid ${connected ? BRAND.neon + '33' : C.border}`, borderRadius: '20px', overflow: 'hidden', transition: 'border-color 0.4s' }}>

        {/* Card header */}
        <div style={{ padding: '1.1rem 1.3rem', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.82rem', color: C.textMid, fontWeight: '600' }}>The Rooftop</div>
          {connected
            ? <div style={{ fontSize: '0.72rem', background: BRAND.neon + '18', color: BRAND.neon, border: `1px solid ${BRAND.neon}44`, borderRadius: '99px', padding: '0.2rem 0.7rem', fontWeight: '700' }}>{t('demo.money.connected')}</div>
            : <div style={{ fontSize: '0.72rem', background: '#1a0a00', color: BRAND.orange, border: `1px solid ${BRAND.orange}44`, borderRadius: '99px', padding: '0.2rem 0.7rem', fontWeight: '700' }}>{t('demo.money.notConnected')}</div>
          }
        </div>

        {/* Balance */}
        <div style={{ padding: '1.5rem 1.3rem 1rem', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontSize: '0.72rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.3rem' }}>{t('demo.money.balance')}</div>
          <div style={{ fontSize: '2.4rem', fontWeight: '900', letterSpacing: '-0.03em', color: connected ? BRAND.neon : C.textMid, transition: 'color 0.4s' }}>
            ${balance.toLocaleString()}
            <span style={{ fontSize: '1rem', fontWeight: '400', color: C.textMid, marginLeft: '0.3rem' }}>USD</span>
          </div>
          {connected && balance > 0 && (
            <div style={{ fontSize: '0.78rem', color: C.textMid, marginTop: '0.3rem' }}>
              {t('demo.money.ticketsSold', { n: idxRef.current })}
            </div>
          )}
        </div>

        {/* Feed */}
        <div style={{ minHeight: '160px', padding: '0.6rem 0' }}>
          {!connected ? (
            <div style={{ padding: '2rem 1.3rem', textAlign: 'center' }}>
              {/* Stripe Connect button */}
              <button
                onClick={handleConnect}
                disabled={connecting}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.6rem',
                  background: connecting ? '#1a1a2a' : '#635BFF',
                  color: '#fff', border: 'none', borderRadius: '10px',
                  padding: '0.85rem 1.6rem', fontSize: '0.95rem', fontWeight: '700',
                  cursor: connecting ? 'wait' : 'pointer', transition: 'all 0.2s',
                  width: '100%', justifyContent: 'center',
                }}
              >
                {connecting ? (
                  <>
                    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>↻</span>
                    {t('demo.money.connecting')}
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '1.1rem' }}>S</span>
                    {t('demo.money.connect')}
                  </>
                )}
              </button>
              <div style={{ color: C.textMid, fontSize: '0.75rem', marginTop: '0.8rem', lineHeight: 1.5 }}>
                {t('demo.money.payoutNote')}
              </div>
            </div>
          ) : (
            <div>
              {feed.length === 0 && (
                <div style={{ padding: '2rem 1.3rem', textAlign: 'center', color: C.textMid, fontSize: '0.82rem' }}>
                  {t('demo.money.waitingFirst')}
                </div>
              )}
              {feed.map((sale, i) => (
                <div
                  key={sale.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0.55rem 1.3rem',
                    background: i === 0 ? BRAND.neon + '0a' : 'transparent',
                    borderBottom: `1px solid ${C.border}`,
                    transition: 'background 0.6s',
                    animation: i === 0 ? 'fadeIn 0.3s ease' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#1a1a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', color: C.textMid, fontWeight: '700', flexShrink: 0 }}>
                      {sale.name.split(' ').map(w => w[0]).join('')}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.82rem', color: C.text, fontWeight: '600' }}>{sale.name}</div>
                      <div style={{ fontSize: '0.7rem', color: C.textMid }}>{t('demo.money.tierSuffix', { tier: sale.tier })}</div>
                    </div>
                  </div>
                  <div style={{ color: BRAND.neon, fontWeight: '800', fontSize: '0.9rem' }}>+${sale.amount}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer note */}
        {connected && balance >= 105 && (
          <div style={{ padding: '0.9rem 1.3rem', borderTop: `1px solid ${C.border}`, background: '#0a1400', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1rem' }}>🏦</span>
            <div style={{ fontSize: '0.78rem', color: BRAND.neon, lineHeight: 1.4 }}>
              <strong>{t('demo.money.depositLabel')}</strong> {t('demo.money.depositPaid', { amount: '$' + Math.floor(balance * 0.4).toLocaleString() })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── BAR DEMO ─────────────────────────────────────────────────────────────────
const BAR_MENU = [
  { id: 1, name: 'Suero',           desc: 'The morning after, before it starts', price: 8,  img: '/drinks/suero.jpg' },
  { id: 2, name: 'Suero con Mezcal',desc: 'Smoke in the remedy',                price: 12, img: '/drinks/sueroconmezcal.jpg' },
  { id: 3, name: 'Cerveza',         desc: 'Fría. Siempre fría.',                price: 6,  img: '/drinks/cerveza.jpg' },
  { id: 4, name: 'Michelada',       desc: 'Limón, sal, chamoy, fuego',          price: 9,  img: '/drinks/michelada.jpg' },
]

function AlleycatBar() {
  const t = useT()
  const [cart, setCart]       = useState({})   // { id: qty }
  const [screen, setScreen]   = useState('menu') // menu | confirm
  const [name, setName]       = useState('')
  const [orderNum, setOrderNum] = useState(null)

  const total     = BAR_MENU.reduce((s, i) => s + (cart[i.id] || 0) * i.price, 0)
  const itemCount = Object.values(cart).reduce((s, q) => s + q, 0)

  const add    = id => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }))
  const remove = id => setCart(c => {
    const n = { ...c }
    if (n[id] > 1) { n[id]-- } else { delete n[id] }
    return n
  })

  const placeOrder = () => {
    setOrderNum(Math.floor(1000 + Math.random() * 9000))
    setScreen('confirm')
  }

  const reset = () => { setCart({}); setName(''); setScreen('menu'); setOrderNum(null) }

  if (screen === 'confirm') return (
    <div style={{ background: '#0a0a0a', minHeight: '100%', padding: '2.5rem 2rem', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎉</div>
      <div style={{ fontSize: '0.72rem', color: BRAND.pink, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: '700', marginBottom: '0.4rem' }}>{t('demo.bar.orderPlaced')}</div>
      <div style={{ fontSize: '3.5rem', fontWeight: '900', color: BRAND.neon, letterSpacing: '-0.02em', lineHeight: 1 }}>
        #{orderNum}
      </div>
      <div style={{ color: '#8a8098', fontSize: '0.85rem', margin: '0.6rem 0 1.5rem' }}>
        {name
          ? t('demo.bar.orderSummary.named', { name, total, n: itemCount })
          : t('demo.bar.orderSummary.anon',  { total, n: itemCount })}
      </div>
      <div style={{ background: '#111', borderRadius: '12px', padding: '0.9rem 1.1rem', marginBottom: '1.5rem' }}>
        {BAR_MENU.filter(i => cart[i.id]).map(i => (
          <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#e8e0d0', marginBottom: '0.3rem' }}>
            <span>{cart[i.id]}× {i.name}</span>
            <span style={{ color: BRAND.orange }}>${cart[i.id] * i.price}</span>
          </div>
        ))}
      </div>
      <button onClick={reset} style={{ background: 'transparent', border: `1px solid #333`, color: '#8a8098', borderRadius: '8px', padding: '0.6rem 1.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
        {t('demo.bar.startNew')}
      </button>
    </div>
  )

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100%' }}>
      {/* Bar header */}
      <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid #1a1a24', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: '800', fontSize: '0.95rem', color: '#e8e0d0' }}>{t('demo.bar.title')}</div>
          <div style={{ fontSize: '0.72rem', color: '#8a8098' }}>{t('demo.bar.dateVenue')}</div>
        </div>
        {itemCount > 0 && (
          <div style={{ background: BRAND.pink, color: '#fff', borderRadius: '99px', fontSize: '0.72rem', fontWeight: '800', padding: '0.2rem 0.6rem' }}>
            {t('demo.bar.inCart', { n: itemCount })}
          </div>
        )}
      </div>

      {/* Menu grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', padding: '1rem' }}>
        {BAR_MENU.map(item => {
          const qty = cart[item.id] || 0
          return (
            <div key={item.id} style={{
              background: qty > 0 ? '#0d0d18' : '#111',
              border: `1px solid ${qty > 0 ? BRAND.pink + '55' : '#1e1e2a'}`,
              borderRadius: '12px',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}>
              <img src={item.img} alt={item.name} style={{ width: '100%', height: '90px', objectFit: 'cover', display: 'block' }} />
              <div style={{ padding: '0.65rem 0.75rem 0.75rem' }}>
              <div style={{ fontWeight: '700', fontSize: '0.88rem', color: '#e8e0d0', marginBottom: '0.15rem' }}>{item.name}</div>
              <div style={{ fontSize: '0.72rem', color: '#5a5070', marginBottom: '0.6rem', lineHeight: 1.3 }}>{item.desc}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: '700', fontSize: '0.9rem', color: qty > 0 ? BRAND.neon : BRAND.orange }}>${item.price}</span>
                {qty === 0 ? (
                  <button onClick={() => add(item.id)} style={{
                    background: BRAND.gradientAngle, color: '#000', border: 'none',
                    borderRadius: '6px', padding: '0.25rem 0.7rem', fontSize: '0.8rem',
                    fontWeight: '700', cursor: 'pointer',
                  }}>{t('demo.bar.add')}</button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button onClick={() => remove(item.id)} style={{ background: '#222', border: 'none', color: '#e8e0d0', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>−</button>
                    <span style={{ color: BRAND.neon, fontWeight: '700', fontSize: '0.9rem', minWidth: '16px', textAlign: 'center' }}>{qty}</span>
                    <button onClick={() => add(item.id)} style={{ background: '#222', border: 'none', color: '#e8e0d0', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>+</button>
                  </div>
                )}
              </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Cart footer */}
      {itemCount > 0 && (
        <div style={{ padding: '0 1rem 1rem' }}>
          <div style={{ background: '#111', border: `1px solid #1e1e2a`, borderRadius: '12px', padding: '0.8rem 1rem', marginBottom: '0.7rem' }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('demo.bar.namePh')}
              style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', fontSize: '0.88rem', color: '#e8e0d0' }}
            />
          </div>
          <button onClick={placeOrder} style={{
            width: '100%',
            background: BRAND.gradientAngle,
            border: 'none',
            borderRadius: '12px',
            padding: '0.9rem',
            fontSize: '1rem',
            fontWeight: '800',
            color: '#000',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>{t('demo.bar.placeOrder')}</span>
            <span>${total}</span>
          </button>
        </div>
      )}
    </div>
  )
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
export default function GrailDemo() {
  const t = useT()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      color: C.text,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textAlign: 'left',
    }}>

      {/* ── STICKY NAV ── */}
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        zIndex: 50,
        padding: '0.8rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: scrolled ? 'rgba(8,8,12,0.95)' : 'transparent',
        borderBottom: scrolled ? `1px solid ${C.border}` : '1px solid transparent',
        transition: 'all 0.2s',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <Link to="/" style={{
            background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid,
            borderRadius: '8px', padding: '0.35rem 0.7rem', fontSize: '0.78rem',
            textDecoration: 'none', fontWeight: '600',
          }}>
            {t('common.back')}
          </Link>
          <AlleycatLogo size={30} />
          <span style={{ color: C.text, fontWeight: '700', fontSize: '0.9rem' }}>GRAIL</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{
            fontSize: '0.7rem',
            color: C.textMid,
            border: `1px solid ${C.border}`,
            borderRadius: '99px',
            padding: '0.2rem 0.6rem',
          }}>
            {t('demo.nav.poweredBy')}
          </span>
          <a
            href="mailto:jp@casadecopas.com?subject=Run my event on GRAIL"
            style={{
              background: BRAND.gradient,
              color: '#000',
              borderRadius: '8px',
              padding: '0.4rem 0.9rem',
              fontSize: '0.78rem',
              fontWeight: '800',
              textDecoration: 'none',
            }}
          >
            {t('demo.nav.cta')}
          </a>
        </div>
      </div>

      {/* ── HERO ── */}
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '6rem 1.5rem 4rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Glow */}
        <div style={{
          position: 'absolute',
          top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: '600px', height: '600px',
          background: 'radial-gradient(ellipse, rgba(204,68,238,0.08) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        <AlleycatLogo size={90} />

        <div style={{
          marginTop: '1.5rem',
          fontSize: 'clamp(2.2rem, 6vw, 4rem)',
          fontWeight: '900',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          maxWidth: '700px',
        }}>
          {t('demo.hero.pre')}
          <span style={{
            background: BRAND.gradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {t('demo.hero.highlight')}
          </span>
          {t('demo.hero.post')}
        </div>

        <div style={{
          marginTop: '1.2rem',
          color: C.textMid,
          fontSize: 'clamp(0.9rem, 2vw, 1.1rem)',
          maxWidth: '480px',
          lineHeight: 1.6,
        }}>
          {t('demo.hero.body')}
        </div>

        <div style={{ display: 'flex', gap: '0.8rem', marginTop: '2.2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <a
            href="#demo"
            style={{
              background: BRAND.gradient,
              color: '#000',
              borderRadius: '10px',
              padding: '0.8rem 1.8rem',
              fontSize: '0.95rem',
              fontWeight: '800',
              textDecoration: 'none',
            }}
          >
            {t('demo.hero.ctaSee')}
          </a>
          <a
            href="mailto:jp@casadecopas.com?subject=Run my event on GRAIL"
            style={{
              background: 'transparent',
              color: C.textMid,
              border: `1px solid ${C.border}`,
              borderRadius: '10px',
              padding: '0.8rem 1.8rem',
              fontSize: '0.95rem',
              textDecoration: 'none',
            }}
          >
            {t('demo.hero.ctaTalk')}
          </a>
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex',
          gap: '2.5rem',
          marginTop: '3.5rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          {[
            ['ATL', 'House / Techno'],
            ['300', t('demo.stats.capacity')],
            ['0',   t('demo.stats.sideDeals')],
          ].map(([n, l]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: '900', color: C.text }}>{n}</div>
              <div style={{ fontSize: '0.72rem', color: C.textMid, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div style={{ padding: '5rem 0', borderTop: `1px solid ${C.border}` }}>
        <Section>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <div style={{ fontSize: '0.72rem', color: BRAND.pink, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: '700', marginBottom: '0.6rem' }}>
              {t('demo.protocol.eyebrow')}
            </div>
            <div style={{ fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', fontWeight: '800', lineHeight: 1.2 }}>
              {t('demo.protocol.heading')}
            </div>
          </div>
          <div style={{ maxWidth: '520px', margin: '0 auto' }}>
            <Timeline />
          </div>
        </Section>
      </div>

      {/* ── CONTRACT PREVIEW ── */}
      <div style={{ padding: '4rem 0', borderTop: `1px solid ${C.border}`, background: C.surface }}>
        <Section>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.72rem', color: BRAND.pink, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: '700', marginBottom: '0.5rem' }}>
              {t('demo.contract.eyebrow')}
            </div>
            <div style={{ fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', fontWeight: '800', marginBottom: '0.4rem' }}>
              {t('demo.contract.heading')}
            </div>
            <div style={{ color: C.textMid, fontSize: '0.88rem' }}>
              {t('demo.contract.body')}
            </div>
          </div>
          <ContractPreview />
        </Section>
      </div>

      {/* ── WHAT IF ENGINE ── */}
      <div id="demo" style={{ padding: '5rem 0', borderTop: `1px solid ${C.border}` }}>
        <Section>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.72rem', color: BRAND.pink, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: '700', marginBottom: '0.5rem' }}>
              {t('demo.whatIf.eyebrow')}
            </div>
            <div style={{ fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', fontWeight: '800', marginBottom: '0.4rem' }}>
              {t('demo.whatIf.heading')}
            </div>
            <div style={{ color: C.textMid, fontSize: '0.88rem', maxWidth: '520px' }}>
              {t('demo.whatIf.body')}
            </div>
          </div>
          <WhatIfBlock />
        </Section>
      </div>

      {/* ── BAR DEMO ── */}
      <div style={{ padding: '5rem 0', borderTop: `1px solid ${C.border}`, background: C.surface }}>
        <Section>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'start' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: BRAND.pink, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: '700', marginBottom: '0.5rem' }}>
                {t('demo.bar.eyebrow')}
              </div>
              <div style={{ fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', fontWeight: '800', marginBottom: '0.8rem', lineHeight: 1.2 }}>
                {t('demo.bar.heading')}
              </div>
              <div style={{ color: C.textMid, fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '1.2rem' }}>
                {t('demo.bar.body')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {[
                  ['🕊', t('demo.bar.bullet1')],
                  ['📋', t('demo.bar.bullet2')],
                  ['⚡', t('demo.bar.bullet3')],
                ].map(([icon, text]) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', fontSize: '0.85rem', color: C.textMid }}>
                    <span style={{ fontSize: '1rem', flexShrink: 0 }}>{icon}</span>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Phone shell */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{
                width: '320px',
                background: '#111',
                borderRadius: '44px',
                boxShadow: '0 0 0 2px #2a2a2a, 0 0 0 6px #1a1a1a, 0 30px 80px rgba(0,0,0,0.7)',
                padding: '14px 10px',
                position: 'relative',
              }}>
                {/* Side buttons */}
                <div style={{ position: 'absolute', left: '-4px', top: '80px', width: '4px', height: '30px', background: '#2a2a2a', borderRadius: '2px 0 0 2px' }} />
                <div style={{ position: 'absolute', left: '-4px', top: '122px', width: '4px', height: '44px', background: '#2a2a2a', borderRadius: '2px 0 0 2px' }} />
                <div style={{ position: 'absolute', left: '-4px', top: '178px', width: '4px', height: '44px', background: '#2a2a2a', borderRadius: '2px 0 0 2px' }} />
                <div style={{ position: 'absolute', right: '-4px', top: '120px', width: '4px', height: '60px', background: '#2a2a2a', borderRadius: '0 2px 2px 0' }} />

                {/* Screen bezel */}
                <div style={{
                  background: '#000',
                  borderRadius: '34px',
                  overflow: 'hidden',
                  height: '620px',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  {/* Status bar */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 22px 6px',
                    background: '#0a0a0a',
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#e8e0d0' }}>9:41</span>
                    {/* Notch pill */}
                    <div style={{ width: '80px', height: '18px', background: '#000', borderRadius: '99px', border: '1.5px solid #222' }} />
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.6rem', color: '#e8e0d0' }}>▲▲▲</div>
                      <div style={{ fontSize: '0.6rem', color: '#e8e0d0' }}>⚡</div>
                    </div>
                  </div>

                  {/* Scrollable app content */}
                  <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                    <AlleycatBar />
                  </div>

                  {/* Home indicator */}
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 10px', background: '#0a0a0a', flexShrink: 0 }}>
                    <div style={{ width: '100px', height: '4px', background: '#444', borderRadius: '99px' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Section>
      </div>

      {/* ── PRICING / MISSION ── */}
      <div style={{ padding: '5rem 0', borderTop: `1px solid ${C.border}` }}>
        <Section>
          {/* Top: 2% hero */}
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <div style={{ fontSize: '0.72rem', color: BRAND.pink, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: '700', marginBottom: '0.8rem' }}>
              {t('demo.cut.eyebrow')}
            </div>
            <div style={{ fontSize: 'clamp(4rem, 12vw, 7rem)', fontWeight: '900', lineHeight: 1, letterSpacing: '-0.04em', background: BRAND.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '0.4rem' }}>
              2%
            </div>
            <div style={{ fontSize: 'clamp(1.1rem, 3vw, 1.5rem)', fontWeight: '700', color: C.text, marginBottom: '0.6rem' }}>
              {t('demo.cut.flatHeading')}
            </div>
            <div style={{ color: C.textMid, fontSize: '0.9rem', maxWidth: '460px', margin: '0 auto', lineHeight: 1.7 }}>
              {t('demo.cut.body')}
            </div>
          </div>

          {/* Comparison table */}
          <div style={{ maxWidth: '620px', margin: '0 auto 3.5rem', background: '#0d0d14', border: `1px solid ${C.border}`, borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', padding: '0.6rem 1.2rem', borderBottom: `1px solid ${C.border}`, background: '#111' }}>
              <div style={{ fontSize: '0.72rem', color: C.textMid, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('demo.compare.platform')}</div>
              <div style={{ fontSize: '0.72rem', color: C.textMid, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center', minWidth: '80px' }}>{t('demo.compare.fee')}</div>
              <div style={{ fontSize: '0.72rem', color: C.textMid, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right', minWidth: '100px' }}>{t('demo.compare.cost')}</div>
            </div>
            {[
              { name: 'Ticketmaster',  fee: '27%', cost: '$9.45', bad: true },
              { name: 'Eventbrite',    fee: '9–12%', cost: '$3.15–4.20', bad: true },
              { name: 'Dice',          fee: '7–10%', cost: '$2.45–3.50', bad: true },
              { name: 'GRAIL',         fee: '2%', cost: '$0.70', grail: true },
            ].map((row, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr auto auto',
                padding: '0.85rem 1.2rem',
                borderBottom: i < 3 ? `1px solid ${C.border}` : 'none',
                background: row.grail ? BRAND.neon + '08' : 'transparent',
                alignItems: 'center',
              }}>
                <div style={{ fontWeight: row.grail ? '800' : '500', color: row.grail ? BRAND.neon : C.text, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {row.grail && <span style={{ fontSize: '0.65rem', background: BRAND.neon, color: '#000', borderRadius: '4px', padding: '0.1rem 0.4rem', fontWeight: '800' }}>US</span>}
                  {row.name}
                </div>
                <div style={{ textAlign: 'center', minWidth: '80px', fontWeight: row.grail ? '800' : '400', color: row.grail ? BRAND.neon : C.red, fontSize: '0.9rem' }}>
                  {row.fee}
                </div>
                <div style={{ textAlign: 'right', minWidth: '100px', color: row.grail ? BRAND.neon : C.textMid, fontWeight: row.grail ? '800' : '400', fontSize: '0.9rem' }}>
                  {row.cost}
                </div>
              </div>
            ))}
            <div style={{ padding: '0.8rem 1.2rem', background: '#0a1400', borderTop: `1px solid ${BRAND.neon}22`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: BRAND.neon, fontSize: '0.82rem', fontWeight: '700' }}>→</span>
              <span style={{ color: BRAND.neon, fontSize: '0.82rem', fontWeight: '600' }}>
                {t('demo.compare.savings')}
              </span>
            </div>
          </div>

          {/* Nonprofit mission statement */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', maxWidth: '620px', margin: '0 auto' }}>
            {[
              { icon: '🎵', title: t('demo.mission.c1.title'), body: t('demo.mission.c1.body') },
              { icon: '⚡', title: t('demo.mission.c2.title'), body: t('demo.mission.c2.body') },
              { icon: '♻️', title: t('demo.mission.c3.title'), body: t('demo.mission.c3.body') },
              { icon: '🔓', title: t('demo.mission.c4.title'), body: t('demo.mission.c4.body') },
            ].map((card, i) => (
              <div key={i} style={{ background: '#0d0d14', border: `1px solid ${C.border}`, borderRadius: '14px', padding: '1.3rem' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.6rem' }}>{card.icon}</div>
                <div style={{ fontWeight: '700', fontSize: '0.9rem', color: C.text, marginBottom: '0.4rem' }}>{card.title}</div>
                <div style={{ color: C.textMid, fontSize: '0.8rem', lineHeight: 1.6 }}>{card.body}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* ── STRIPE CONNECT ── */}
      <div style={{ padding: '5rem 0', borderTop: `1px solid ${C.border}` }}>
        <Section>
          <StripeConnectDemo />
        </Section>
      </div>

      {/* ── FEATURES GRID ── */}
      <div style={{ padding: '5rem 0', borderTop: `1px solid ${C.border}`, background: C.surface }}>
        <Section>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{ fontSize: '0.72rem', color: BRAND.pink, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: '700', marginBottom: '0.5rem' }}>
              {t('demo.tools.eyebrow')}
            </div>
            <div style={{ fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', fontWeight: '800' }}>
              {t('demo.tools.heading')}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
            <FeatureCard emoji="🕊"  title={t('demo.tools.f1.title')} tag={t('demo.tools.f1.tag')} desc={t('demo.tools.f1.desc')} />
            <FeatureCard emoji="🍹"  title={t('demo.tools.f2.title')} tag={t('demo.tools.f2.tag')} desc={t('demo.tools.f2.desc')} />
            <FeatureCard emoji="🌅"  title={t('demo.tools.f3.title')} tag={t('demo.tools.f3.tag')} desc={t('demo.tools.f3.desc')} />
            <FeatureCard emoji="💰"  title={t('demo.tools.f4.title')} tag={t('demo.tools.f4.tag')} desc={t('demo.tools.f4.desc')} />
          </div>
        </Section>
      </div>

      {/* ── THE PHILOSOPHY ── */}
      <div style={{ padding: '5rem 0', borderTop: `1px solid ${C.border}` }}>
        <Section style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 'clamp(1.3rem, 4vw, 2rem)',
            fontWeight: '800',
            lineHeight: 1.4,
            maxWidth: '580px',
            margin: '0 auto',
          }}>
            "{t('demo.philosophy.line1')}<br />
            <span style={{
              background: BRAND.gradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              {t('demo.philosophy.line2')}"
            </span>
          </div>
          <div style={{ color: C.textMid, fontSize: '0.85rem', marginTop: '1rem' }}>
            {t('demo.philosophy.attrib')}
          </div>
        </Section>
      </div>

      {/* ── CTA ── */}
      <div style={{
        padding: '5rem 1.5rem',
        borderTop: `1px solid ${C.border}`,
        background: C.surface,
        textAlign: 'center',
      }}>
        <AlleycatLogo size={60} />
        <div style={{
          fontSize: 'clamp(1.5rem, 4vw, 2.2rem)',
          fontWeight: '900',
          marginTop: '1.2rem',
          marginBottom: '0.5rem',
        }}>
          {t('demo.cta.heading')}
        </div>
        <div style={{ color: C.textMid, fontSize: '0.9rem', marginBottom: '2rem' }}>
          {t('demo.cta.body')}
        </div>
        <a
          href="mailto:jp@casadecopas.com?subject=Run my event on GRAIL — Let's talk"
          style={{
            display: 'inline-block',
            background: BRAND.gradient,
            color: '#000',
            borderRadius: '12px',
            padding: '1rem 2.5rem',
            fontSize: '1rem',
            fontWeight: '800',
            textDecoration: 'none',
            boxShadow: '0 4px 30px rgba(204,68,238,0.25)',
          }}
        >
          {t('demo.cta.btn')}
        </a>
        <div style={{ marginTop: '1rem', color: C.textDim, fontSize: '0.75rem' }}>
          jp@casadecopas.com · GRAIL Protocol
        </div>
      </div>

    </div>
  )
}
