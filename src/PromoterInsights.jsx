import React, { useEffect, useState } from 'react'
import { QRCode } from 'react-qrcode-logo'
import { fmtPriceCents } from './currencies'
import { BRAND, C, FONT, eyebrowStyle } from './theme'

// ─── PROMOTER INSIGHTS ───────────────────────────────────────────────────────
// Visual side of the promoter event detail. Cards use the same dark-pink
// design language as GrailHome / EventPage — ambient glows, gradient cards,
// dashed ticket-stub dividers, drop shadows, big negative-tracking type.

// Reusable section header: small pink eyebrow + white headline + caption.
// Keeps every card opening to the same rhythm.
function SectionHead({ eyebrow, title, caption, accent = BRAND.pink, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ ...eyebrowStyle(accent), fontSize: '0.65rem', marginBottom: '0.35rem' }}>
          {eyebrow}
        </div>
        <div style={{ color: C.text, fontSize: '1.1rem', fontWeight: '900', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {title}
        </div>
        {caption && (
          <div style={{ color: C.textMid, fontSize: '0.78rem', marginTop: '0.25rem' }}>
            {caption}
          </div>
        )}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  )
}

// Ticket-stub dashed divider with a center bg-color cutout — same look
// fans see on their ticket. Reinforces the brand in the promoter view.
function StubDivider({ color = C.border }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', margin: '1.1rem 0' }}>
      <div style={{ flex: 1, borderTop: `1.5px dashed ${color}` }} />
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: C.bg, border: `1px solid ${color}`, flexShrink: 0 }} />
      <div style={{ flex: 1, borderTop: `1.5px dashed ${color}` }} />
    </div>
  )
}

// ─── HERO OVERVIEW ───────────────────────────────────────────────────────────
// Big visual block at the top. Capacity ring + live countdown + headline
// take, all sitting on top of an ambient pink/orange radial glow that
// matches the public ticket page. Past events flip to "Wrapped" presentation.

export function HeroOverview({ event, sold, cap, totalNetCents, admittedCount, eventLink }) {
  const date = event?.show_date || event?.event_date
  const showDate = date ? new Date(date) : null
  const now = new Date()
  const isPast = showDate && showDate < now
  const pct = cap > 0 ? Math.min(1, sold / cap) : 0

  // Live ticking countdown — re-renders every minute. Cheap.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (isPast || !showDate) return
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [isPast, showDate?.getTime()])

  const countdown = (() => {
    if (!showDate) return { big: '—', label: 'No date set' }
    const diffMs = showDate.getTime() - now.getTime()
    if (diffMs <= 0) {
      const sinceMs = -diffMs
      const days = Math.floor(sinceMs / 86_400_000)
      if (days === 0) return { big: 'Tonight', label: 'Show is happening now' }
      return { big: `${days}d ago`, label: 'Past event' }
    }
    const days  = Math.floor(diffMs / 86_400_000)
    const hours = Math.floor((diffMs % 86_400_000) / 3_600_000)
    const mins  = Math.floor((diffMs % 3_600_000) / 60_000)
    if (days >= 2)  return { big: `${days}d`, label: `${hours}h ${mins}m to doors` }
    if (days === 1) return { big: `1d ${hours}h`, label: `${mins}m and counting` }
    if (hours >= 1) return { big: `${hours}h ${mins}m`, label: 'Doors very soon' }
    return { big: `${mins}m`, label: 'Doors any minute' }
  })()

  const ringColor = pct >= 0.9 ? BRAND.neon : pct >= 0.5 ? BRAND.pink : BRAND.orange

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: `linear-gradient(135deg, #0d0a18 0%, #160b1f 45%, #1f0a14 100%)`,
      border: `1px solid ${BRAND.pink}33`,
      borderRadius: '20px',
      marginBottom: '1.25rem',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    }}>
      {/* Two-layer ambient glow — outer pink wash + inner ring color halo */}
      <div style={{
        position: 'absolute', top: '-20%', right: '-10%',
        width: '60%', height: '140%', pointerEvents: 'none',
        background: `radial-gradient(ellipse at center, ${ringColor}22 0%, transparent 60%)`,
        filter: 'blur(8px)',
      }} />
      <div style={{
        position: 'absolute', bottom: '-30%', left: '-10%',
        width: '50%', height: '120%', pointerEvents: 'none',
        background: `radial-gradient(ellipse at center, ${BRAND.pink}1a 0%, transparent 65%)`,
      }} />

      <div style={{ position: 'relative', padding: '1.6rem 1.7rem' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap',
        }}>
          <CapacityRing pct={pct} sold={sold} cap={cap} color={ringColor} />

          <div style={{ flex: 1, minWidth: '180px' }}>
            <div style={{ ...eyebrowStyle(BRAND.pink), fontSize: '0.62rem', marginBottom: '0.5rem' }}>
              {isPast ? '🕊 Wrapped' : '🕊 Time to doors'}
            </div>
            <div style={{
              color: C.text, fontSize: '2.6rem', fontWeight: '900',
              letterSpacing: '-0.04em', lineHeight: 0.95,
            }}>
              {countdown.big}
            </div>
            <div style={{ color: C.textMid, fontSize: '0.82rem', marginTop: '0.4rem' }}>
              {countdown.label}
            </div>
          </div>
        </div>

        {(totalNetCents > 0 || admittedCount > 0) && (
          <>
            <StubDivider color={`${BRAND.pink}33`} />
            <div style={{
              display: 'flex', gap: '1.5rem', flexWrap: 'wrap',
              alignItems: 'baseline', justifyContent: 'space-between',
            }}>
              {totalNetCents > 0 && (
                <HeroStat
                  label="Net so far"
                  value={fmtPriceCents(totalNetCents, event?.currency)}
                  accent={BRAND.neon}
                  big
                />
              )}
              {admittedCount > 0 && (
                <HeroStat
                  label={isPast ? 'Admitted' : 'Through the door'}
                  value={`${admittedCount} of ${sold}`}
                  accent={C.text}
                />
              )}
              {sold > 0 && (
                <HeroStat
                  label="Capacity filled"
                  value={`${Math.round(pct * 100)}%`}
                  accent={ringColor}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function HeroStat({ label, value, accent, big = false }) {
  return (
    <div>
      <div style={{ ...eyebrowStyle(C.textMid), fontSize: '0.58rem', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{
        color: accent,
        fontSize: big ? '1.5rem' : '1.1rem',
        fontWeight: '900', letterSpacing: '-0.025em', lineHeight: 1,
      }}>
        {value}
      </div>
    </div>
  )
}

function CapacityRing({ pct, sold, cap, color }) {
  const size   = 150
  const stroke = 13
  const r      = (size - stroke) / 2
  const c      = 2 * Math.PI * r
  const offset = c * (1 - pct)

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {/* Soft halo behind the ring */}
      <div style={{
        position: 'absolute', inset: '-6px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}33 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <svg width={size} height={size} style={{ position: 'relative', transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={`ringGrad-${Math.round(pct * 100)}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.85" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={C.border} strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={`url(#ringGrad-${Math.round(pct * 100)})`} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ color, fontSize: '1.7rem', fontWeight: '900', letterSpacing: '-0.04em', lineHeight: 1 }}>
          {Math.round(pct * 100)}%
        </div>
        <div style={{ color: C.textMid, fontSize: '0.7rem', marginTop: '0.3rem', letterSpacing: '0.06em' }}>
          {sold} / {cap || '∞'}
        </div>
      </div>
    </div>
  )
}

// ─── SALES VELOCITY CHART ────────────────────────────────────────────────────
// Cumulative tickets sold vs. time, rendered as a smooth area chart in SVG.
// Hides itself when there's not enough data (single sale or none).

export function SalesChart({ tickets, capacity, currency, event }) {
  const live = (tickets || []).filter(t => !t.refunded && t.created_at)
  if (live.length < 2) return null

  // Bucket by day in promoter's local TZ (browser TZ ≈ promoter TZ in practice)
  const byDay = new Map()
  for (const t of live) {
    const d = new Date(t.created_at)
    const key = d.toISOString().slice(0, 10)
    byDay.set(key, (byDay.get(key) || 0) + 1)
  }

  const firstSale = new Date(live.reduce((min, t) => t.created_at < min ? t.created_at : min, live[0].created_at))
  const showDate  = event?.show_date ? new Date(event.show_date) : new Date()
  const endDate   = showDate < new Date() ? showDate : new Date()
  const dayMs = 86_400_000
  const startKey = firstSale.toISOString().slice(0, 10)
  const endKey   = endDate.toISOString().slice(0, 10)

  // Walk every day from first sale to today/show — fill gaps with zero so
  // the line shows actual silence instead of teleporting to the next sale.
  const days = []
  let cursor = new Date(`${startKey}T00:00:00Z`)
  const stop = new Date(`${endKey}T00:00:00Z`)
  let cumulative = 0
  while (cursor.getTime() <= stop.getTime()) {
    const k = cursor.toISOString().slice(0, 10)
    cumulative += byDay.get(k) || 0
    days.push({ key: k, date: new Date(cursor), cumulative, daily: byDay.get(k) || 0 })
    cursor = new Date(cursor.getTime() + dayMs)
  }
  if (days.length < 2) return null

  const W = 600
  const H = 170
  const padX = 10
  const padTop = 12
  const padBot = 24
  const innerW = W - padX * 2
  const innerH = H - padTop - padBot
  const maxY = Math.max(capacity || 0, days[days.length - 1].cumulative, 1)

  const xFor = i => padX + (i / (days.length - 1)) * innerW
  const yFor = v => padTop + innerH - (v / maxY) * innerH

  const linePath = days.map((d, i) =>
    `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(d.cumulative).toFixed(1)}`
  ).join(' ')
  const areaPath = `${linePath} L ${xFor(days.length - 1).toFixed(1)} ${yFor(0).toFixed(1)} L ${xFor(0).toFixed(1)} ${yFor(0).toFixed(1)} Z`

  const lastSeven = days.slice(-7)
  const last7Sold = lastSeven.reduce((s, d) => s + d.daily, 0)
  const avgPerDay = (last7Sold / lastSeven.length).toFixed(1)
  const peakDay   = days.reduce((peak, d) => d.daily > peak.daily ? d : peak, days[0])

  const labelDays = [
    { idx: 0, d: days[0] },
    days.length > 6 ? { idx: days.findIndex(x => x === peakDay), d: peakDay } : null,
    { idx: days.length - 1, d: days[days.length - 1] },
  ].filter(Boolean)

  const fmtShortDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  // Sellout projection — only when meaningful
  const remaining = capacity ? capacity - days[days.length - 1].cumulative : 0
  const showProjection = capacity > 0 && remaining > 0 && Number(avgPerDay) > 0
  const daysToSellout = showProjection ? Math.ceil(remaining / Number(avgPerDay)) : null

  const gradId = `salesArea-${days.length}`

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      background: `linear-gradient(135deg, ${C.card} 0%, #160b1f 100%)`,
      border: `1px solid ${C.border}`,
      borderRadius: '18px', padding: '1.3rem 1.4rem 1.4rem',
      marginBottom: '1.75rem',
      boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
    }}>
      {/* Subtle ambient glow */}
      <div style={{
        position: 'absolute', top: '-30%', right: '-15%',
        width: '50%', height: '120%', pointerEvents: 'none',
        background: `radial-gradient(ellipse, ${BRAND.pink}1a 0%, transparent 65%)`,
      }} />

      <div style={{ position: 'relative' }}>
        <SectionHead
          eyebrow="Sales velocity"
          title={
            <>
              {avgPerDay}<span style={{ color: C.textMid, fontWeight: '600', fontSize: '0.78rem', marginLeft: '0.4rem' }}>tickets/day · last {lastSeven.length}</span>
            </>
          }
          caption={`Peak: ${peakDay.daily} on ${fmtShortDate(peakDay.date)}`}
          right={showProjection ? (
            <div style={{
              padding: '0.55rem 0.85rem',
              background: `${BRAND.neon}14`,
              border: `1px solid ${BRAND.neon}44`,
              borderRadius: '10px',
              textAlign: 'right',
            }}>
              <div style={{ color: BRAND.neon, fontSize: '1.05rem', fontWeight: '900', letterSpacing: '-0.02em', lineHeight: 1 }}>
                ~{daysToSellout}d
              </div>
              <div style={{ color: C.textMid, fontSize: '0.66rem', marginTop: '0.2rem', letterSpacing: '0.05em' }}>
                to sellout
              </div>
            </div>
          ) : null}
        />

        <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%"  stopColor={BRAND.pink}   stopOpacity="0.45" />
              <stop offset="60%" stopColor={BRAND.pink}   stopOpacity="0.12" />
              <stop offset="100%" stopColor={BRAND.pink}  stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lineGrad" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%"  stopColor={BRAND.pink} />
              <stop offset="100%" stopColor={BRAND.orange} />
            </linearGradient>
          </defs>

          {/* Capacity reference line */}
          {capacity > 0 && capacity <= maxY && (
            <>
              <line
                x1={padX} x2={W - padX}
                y1={yFor(capacity)} y2={yFor(capacity)}
                stroke={BRAND.neon} strokeOpacity="0.5"
                strokeDasharray="4 4" strokeWidth="1"
              />
              <text x={W - padX} y={yFor(capacity) - 4} textAnchor="end" fill={BRAND.neon} fontSize="9" fontFamily={FONT} opacity="0.7" letterSpacing="0.1em">
                CAPACITY {capacity}
              </text>
            </>
          )}

          <path d={areaPath} fill={`url(#${gradId})`} />
          <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

          {/* Pulse on the latest data point */}
          <circle
            cx={xFor(days.length - 1)} cy={yFor(days[days.length - 1].cumulative)}
            r="10" fill={BRAND.pink} opacity="0.18"
          />
          <circle
            cx={xFor(days.length - 1)} cy={yFor(days[days.length - 1].cumulative)}
            r="5" fill={BRAND.pink} opacity="0.4"
          />
          <circle
            cx={xFor(days.length - 1)} cy={yFor(days[days.length - 1].cumulative)}
            r="3" fill={C.text}
          />

          {/* X-axis labels */}
          {labelDays.map((l, i) => (
            <text
              key={i}
              x={Math.max(28, Math.min(W - 28, xFor(l.idx)))}
              y={H - 4}
              textAnchor={i === 0 ? 'start' : i === labelDays.length - 1 ? 'end' : 'middle'}
              fill={C.textMid} fontSize="10" fontFamily={FONT} letterSpacing="0.05em"
            >
              {fmtShortDate(l.d.date)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  )
}

// ─── TIER PROGRESS BARS ──────────────────────────────────────────────────────
// Each tier becomes a row with a gradient progress bar. Sold-out tiers
// celebrate in neon. Header shows the brand colors. Mirrors the look of
// the public ticket-page tier picker.

export function TierBars({ tiers, currency }) {
  if (!tiers?.length) return null

  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.card} 0%, #110b18 100%)`,
      border: `1px solid ${C.border}`,
      borderRadius: '18px', padding: '1.25rem 1.4rem',
      marginBottom: '1.75rem',
      boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
    }}>
      <SectionHead
        eyebrow="Tier breakdown"
        title="By the door"
        caption={`${tiers.length} tier${tiers.length === 1 ? '' : 's'} live`}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        {tiers.map((t) => {
          const sold = t.sold || 0
          const pct = t.qty > 0 ? Math.min(1, sold / t.qty) : 0
          const remaining = t.qty - sold
          const tierGross = sold * t.price_cents
          const soldout = remaining <= 0 && t.qty > 0
          const fillColor = soldout ? BRAND.neon : pct >= 0.75 ? BRAND.pink : BRAND.orange
          const trackColor = soldout ? `${BRAND.neon}22` : '#0d0d14'

          return (
            <div key={t.id}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.85rem', marginBottom: '0.5rem' }}>
                <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <div style={{ color: C.text, fontWeight: '800', fontSize: '0.98rem', letterSpacing: '-0.01em' }}>
                    {t.name}
                  </div>
                  {soldout && (
                    <span style={{
                      display: 'inline-block',
                      fontSize: '0.62rem', color: BRAND.neon,
                      letterSpacing: '0.15em', fontWeight: '800',
                      padding: '0.15rem 0.55rem',
                      background: `${BRAND.neon}18`,
                      border: `1px solid ${BRAND.neon}44`,
                      borderRadius: '99px',
                    }}>
                      SOLD OUT
                    </span>
                  )}
                </div>
                <div style={{ color: BRAND.pink, fontWeight: '900', fontSize: '1rem', letterSpacing: '-0.02em', flexShrink: 0 }}>
                  {fmtPriceCents(tierGross, currency)}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                <div style={{
                  flex: 1,
                  height: '8px', borderRadius: '99px',
                  background: trackColor,
                  border: `1px solid ${C.border}`,
                  overflow: 'hidden',
                  position: 'relative',
                }}>
                  <div style={{
                    width: `${pct * 100}%`, height: '100%',
                    background: soldout
                      ? `linear-gradient(90deg, ${BRAND.neon}, ${BRAND.pink})`
                      : `linear-gradient(90deg, ${BRAND.pink}, ${fillColor})`,
                    boxShadow: `0 0 12px ${fillColor}66`,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
                <div style={{ flexShrink: 0, color: C.textMid, fontSize: '0.74rem', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.02em', minWidth: '70px', textAlign: 'right' }}>
                  {sold}/{t.qty}
                </div>
              </div>

              <div style={{ color: C.textDim, fontSize: '0.72rem', marginTop: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>{fmtPriceCents(t.price_cents, currency)} each</span>
                <span>{Math.max(0, remaining)} left</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── BUYER INSIGHTS ──────────────────────────────────────────────────────────
// Surfaces the social shape of an event: distinct buyers, biggest party,
// repeat-buyer count. Top buyers list reveals the crews & VIPs.

export function BuyerInsights({ tickets, currency, tiers }) {
  const live = (tickets || []).filter(t => !t.refunded)
  if (live.length === 0) return null

  const groups = new Map()
  for (const t of live) {
    const k = (t.email || '').toLowerCase().trim()
    if (!k) continue
    if (!groups.has(k)) groups.set(k, { email: t.email, name: t.name, tickets: [] })
    groups.get(k).tickets.push(t)
  }

  const buyers = Array.from(groups.values())
  if (buyers.length === 0) return null

  const uniqueBuyers = buyers.length
  const repeatBuyers = buyers.filter(b => b.tickets.length > 1).length
  const largestGroup = buyers.reduce((max, b) => b.tickets.length > max.tickets.length ? b : max, buyers[0])
  const avgGroupSize = (live.length / uniqueBuyers).toFixed(1)

  const topBuyers = [...buyers].sort((a, b) => b.tickets.length - a.tickets.length).slice(0, 5)
  const buyerSpend = (b) => b.tickets.reduce((s, t) => {
    const tier = tiers?.find(x => x.id === t.tier_id)
    return s + (tier?.price_cents || 0)
  }, 0)

  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.card} 0%, #18101e 100%)`,
      border: `1px solid ${C.border}`,
      borderRadius: '18px', padding: '1.25rem 1.4rem',
      marginBottom: '1.75rem',
      boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
    }}>
      <SectionHead
        eyebrow="Buyer insights"
        title="Who's coming"
        caption={`${uniqueBuyers} unique buyer${uniqueBuyers === 1 ? '' : 's'} · ${live.length} ticket${live.length === 1 ? '' : 's'}`}
      />

      <div style={{
        display: 'grid', gap: '0.75rem',
        gridTemplateColumns: 'repeat(auto-fit, minmax(108px, 1fr))',
      }}>
        <InsightTile label="Unique buyers"   value={uniqueBuyers}                     accent={C.text} />
        <InsightTile label="Avg group size"  value={`${avgGroupSize}×`}               accent={BRAND.pink} />
        <InsightTile label="Repeat buyers"   value={repeatBuyers}                     accent={BRAND.neon} />
        <InsightTile label="Largest party"   value={`${largestGroup.tickets.length}`} accent={BRAND.orange} />
      </div>

      {topBuyers.filter(b => b.tickets.length > 1).length > 0 && (
        <>
          <StubDivider color={C.border} />
          <div style={{ ...eyebrowStyle(C.textMid), fontSize: '0.6rem', marginBottom: '0.6rem' }}>
            Top buyers
          </div>
          <div style={{
            background: '#0d0d14',
            border: `1px solid ${C.border}`,
            borderRadius: '12px',
            overflow: 'hidden',
          }}>
            {topBuyers
              .filter(b => b.tickets.length > 1)
              .map((b, i, arr) => (
                <div key={b.email + i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.7rem 0.95rem', fontSize: '0.84rem',
                  borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
                }}>
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ color: C.text, fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.name || '—'}
                    </div>
                    <div style={{ color: C.textMid, fontSize: '0.74rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.1rem' }}>
                      {b.email}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexShrink: 0, marginLeft: '0.85rem' }}>
                    <span style={{
                      color: BRAND.pink, fontWeight: '900', fontSize: '0.95rem',
                      letterSpacing: '-0.02em',
                      padding: '0.2rem 0.55rem',
                      background: `${BRAND.pink}14`,
                      border: `1px solid ${BRAND.pink}33`,
                      borderRadius: '99px',
                    }}>
                      ×{b.tickets.length}
                    </span>
                    <span style={{ color: C.textDim, fontSize: '0.74rem', fontFamily: 'ui-monospace, monospace' }}>
                      {fmtPriceCents(buyerSpend(b), currency)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  )
}

function InsightTile({ label, value, accent }) {
  return (
    <div style={{
      background: '#0d0d14',
      border: `1px solid ${C.border}`,
      borderRadius: '12px',
      padding: '0.75rem 0.85rem',
    }}>
      <div style={{ ...eyebrowStyle(C.textMid), fontSize: '0.56rem', marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ color: accent, fontSize: '1.4rem', fontWeight: '900', letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
    </div>
  )
}

// ─── LANGUAGE BREAKDOWN ──────────────────────────────────────────────────────
// Only renders when audience speaks more than one language. Helps promoter
// judge whether to make IG copy bilingual.

export function LanguageBreakdown({ tickets }) {
  const live = (tickets || []).filter(t => !t.refunded)
  if (live.length === 0) return null

  const counts = new Map()
  for (const t of live) {
    const lang = (t.lang || 'es').toLowerCase()
    counts.set(lang, (counts.get(lang) || 0) + 1)
  }
  if (counts.size < 2) return null

  const total = live.length
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const palette = [BRAND.pink, BRAND.neon, BRAND.orange, BRAND.purple || '#b57bff', BRAND.blue || '#5b9bff']
  const labelFor = (l) => ({ es: 'Spanish', en: 'English', fr: 'French', pt: 'Portuguese', de: 'German' }[l] || l.toUpperCase())

  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.card} 0%, #16101a 100%)`,
      border: `1px solid ${C.border}`,
      borderRadius: '18px', padding: '1.25rem 1.4rem',
      marginBottom: '1.75rem',
      boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
    }}>
      <SectionHead
        eyebrow="Buyer language"
        title="How they bought"
        caption="Split helps you decide whether to post bilingual"
      />

      {/* Stacked bar */}
      <div style={{
        display: 'flex', height: '12px',
        borderRadius: '99px', overflow: 'hidden',
        marginBottom: '0.95rem',
        background: '#0d0d14',
        border: `1px solid ${C.border}`,
      }}>
        {sorted.map(([lang, n], i) => (
          <div key={lang} style={{
            width: `${(n / total) * 100}%`,
            background: `linear-gradient(90deg, ${palette[i % palette.length]}, ${palette[i % palette.length]}cc)`,
            boxShadow: `inset 0 0 10px ${palette[i % palette.length]}99`,
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.7rem 1.3rem', fontSize: '0.82rem' }}>
        {sorted.map(([lang, n], i) => (
          <div key={lang} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: palette[i % palette.length],
              boxShadow: `0 0 8px ${palette[i % palette.length]}99`,
            }} />
            <span style={{ color: C.text, fontWeight: '700' }}>{labelFor(lang)}</span>
            <span style={{ color: C.textMid }}>{n}</span>
            <span style={{ color: C.textDim, fontFamily: 'ui-monospace, monospace', fontSize: '0.74rem' }}>
              {Math.round((n / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── RECENT ACTIVITY FEED ────────────────────────────────────────────────────
// Live ticker of recent purchases — gives promoters the dopamine of watching
// sales come in without having to refresh the attendee list. Auto-relativizes
// timestamps ("2m ago") and re-renders every 30s.

export function ActivityFeed({ tickets, tiers, currency, max = 6 }) {
  const live = (tickets || []).filter(t => !t.refunded && t.created_at)
  // Re-render so relative times stay fresh
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  if (live.length === 0) return null

  // Group identical purchases — same buyer + within 60s = one transaction
  const sorted = [...live].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const grouped = []
  for (const t of sorted) {
    const last = grouped[grouped.length - 1]
    const sameBuyer = last && (t.email || '').toLowerCase() === (last.email || '').toLowerCase()
    const sameTier  = last && t.tier_id === last.tier_id
    const closeInTime = last && Math.abs(new Date(last.created_at) - new Date(t.created_at)) < 60_000
    if (last && sameBuyer && sameTier && closeInTime) {
      last.count += 1
      last.spend += (tiers?.find(x => x.id === t.tier_id)?.price_cents || 0)
    } else {
      grouped.push({
        id: t.id,
        name: t.name,
        email: t.email,
        tier_id: t.tier_id,
        tier_name: t.tier_name,
        created_at: t.created_at,
        count: 1,
        spend: tiers?.find(x => x.id === t.tier_id)?.price_cents || 0,
      })
    }
  }

  const items = grouped.slice(0, max)
  const fmtRel = (iso) => {
    const ms = Date.now() - new Date(iso).getTime()
    if (ms < 60_000) return 'just now'
    const m = Math.floor(ms / 60_000)
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    return `${d}d ago`
  }

  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.card} 0%, #110f1c 100%)`,
      border: `1px solid ${C.border}`,
      borderRadius: '18px', padding: '1.25rem 1.4rem',
      marginBottom: '1.75rem',
      boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
    }}>
      <SectionHead
        eyebrow="Live activity"
        title="Recent purchases"
        caption={live.length > max ? `Showing latest ${items.length} of ${live.length}` : `${live.length} total`}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: BRAND.neon, fontSize: '0.74rem', fontWeight: '700', letterSpacing: '0.08em' }}>
            <span style={{
              display: 'inline-block', width: '8px', height: '8px',
              borderRadius: '50%', background: BRAND.neon,
              boxShadow: `0 0 12px ${BRAND.neon}`,
            }} />
            LIVE
          </div>
        }
      />

      <div style={{
        background: '#0d0d14',
        border: `1px solid ${C.border}`,
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        {items.map((it, i) => (
          <div key={it.id} style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.7rem 0.95rem',
            borderTop: i === 0 ? 'none' : `1px solid ${C.border}`,
          }}>
            <div style={{
              width: '32px', height: '32px',
              borderRadius: '50%',
              background: BRAND.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              fontSize: '0.85rem', fontWeight: '900', color: '#000',
              letterSpacing: '-0.02em',
            }}>
              {(it.name || it.email || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: C.text, fontSize: '0.86rem', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {it.name || it.email || '—'}
                {it.count > 1 && (
                  <span style={{
                    color: BRAND.pink, marginLeft: '0.4rem',
                    fontSize: '0.78rem', fontWeight: '900',
                  }}>
                    ×{it.count}
                  </span>
                )}
              </div>
              <div style={{ color: C.textMid, fontSize: '0.72rem', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {it.tier_name || 'Ticket'} · {fmtPriceCents(it.spend, currency)}
              </div>
            </div>
            <div style={{ flexShrink: 0, color: C.textDim, fontSize: '0.72rem', fontFamily: 'ui-monospace, monospace' }}>
              {fmtRel(it.created_at)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── TOP SOURCES ─────────────────────────────────────────────────────────────
// Where buyers came from. Reads tickets.source which gets populated by
// `?ref=` URL params on the public event page. Only renders when there's
// non-trivial attribution data — otherwise it's a one-bar chart.

export function TopSourcesCard({ tickets }) {
  const live = (tickets || []).filter(t => !t.refunded)
  if (live.length === 0) return null

  const counts = new Map()
  for (const t of live) {
    const src = (t.source || 'direct').toLowerCase().trim() || 'direct'
    counts.set(src, (counts.get(src) || 0) + 1)
  }
  // Don't render if everyone came in direct — no signal to show.
  const hasAttribution = [...counts.keys()].some(k => k !== 'direct' && k !== 'comp')
  if (!hasAttribution) return null

  const total = live.length
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const palette = [BRAND.pink, BRAND.orange, BRAND.neon, BRAND.purple || '#b57bff', BRAND.blue || '#5b9bff', '#dd7aff', '#ffaa55', '#55ddaa']

  // Pretty labels — common social sources get a friendlier name
  const labelFor = (s) => ({
    ig: 'Instagram', insta: 'Instagram', instagram: 'Instagram',
    tw: 'Twitter/X', twitter: 'Twitter/X', x: 'Twitter/X',
    tt: 'TikTok', tiktok: 'TikTok',
    fb: 'Facebook', facebook: 'Facebook',
    wa: 'WhatsApp', whatsapp: 'WhatsApp',
    spotify: 'Spotify',
    direct: 'Direct',
    comp: 'Guest list',
  }[s] || s.replace(/[_-]/g, ' '))

  const max = sorted[0][1]

  return (
    <div style={{
      background: `linear-gradient(135deg, ${C.card} 0%, #18101c 100%)`,
      border: `1px solid ${C.border}`,
      borderRadius: '18px', padding: '1.25rem 1.4rem',
      marginBottom: '1.75rem',
      boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
    }}>
      <SectionHead
        eyebrow="Top sources"
        title="Where they came from"
        caption="Share /e/{slug}?ref=ig style links to track each channel"
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        {sorted.map(([src, n], i) => {
          const pct = n / max
          const color = palette[i % palette.length]
          return (
            <div key={src}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem' }}>
                <div style={{ color: C.text, fontWeight: '700', fontSize: '0.85rem', textTransform: 'capitalize' }}>
                  {labelFor(src)}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span style={{ color, fontWeight: '900', fontSize: '0.95rem', letterSpacing: '-0.02em' }}>{n}</span>
                  <span style={{ color: C.textDim, fontSize: '0.72rem', fontFamily: 'ui-monospace, monospace' }}>
                    {Math.round((n / total) * 100)}%
                  </span>
                </div>
              </div>
              <div style={{
                height: '6px', borderRadius: '99px',
                background: '#0d0d14', border: `1px solid ${C.border}`, overflow: 'hidden',
              }}>
                <div style={{
                  width: `${pct * 100}%`, height: '100%',
                  background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                  boxShadow: `0 0 10px ${color}66`,
                  transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── EVENT QR CARD ───────────────────────────────────────────────────────────
// Mirrors the fan ticket stub from GrailHome — header band, dashed stub
// divider, and a QR that's instantly recognizable as a Grail artifact.

export function EventQRCard({ url, label = 'Ticket page' }) {
  const [expanded, setExpanded] = useState(false)
  const cleanUrl = url.replace(/^https?:\/\//, '')

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`,
      borderRadius: '18px', overflow: 'hidden', marginBottom: '1.75rem',
      boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
    }}>
      {/* Gradient header band — matches the "Tonight's take" visual style */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: `linear-gradient(135deg, ${BRAND.pink}22, ${BRAND.orange}22, transparent)`,
        padding: '1rem 1.3rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
      }}>
        <div style={{
          position: 'absolute', top: '-50%', right: '-10%',
          width: '40%', height: '200%', pointerEvents: 'none',
          background: `radial-gradient(ellipse, ${BRAND.pink}33 0%, transparent 65%)`,
        }} />
        <div style={{ position: 'relative', minWidth: 0 }}>
          <div style={{ ...eyebrowStyle(BRAND.pink), fontSize: '0.62rem', marginBottom: '0.25rem' }}>
            🕊 {label}
          </div>
          <div style={{ color: C.text, fontWeight: '800', fontSize: '1rem', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cleanUrl}
          </div>
          <div style={{ color: C.textMid, fontSize: '0.74rem', marginTop: '0.25rem' }}>
            Show at the door · screenshot for flyers
          </div>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            position: 'relative',
            background: expanded ? 'transparent' : BRAND.gradient,
            color: expanded ? C.textMid : '#000',
            border: expanded ? `1px solid ${C.border}` : 'none',
            borderRadius: '10px',
            padding: '0.55rem 1rem',
            fontSize: '0.8rem', fontWeight: '800',
            cursor: 'pointer', fontFamily: FONT, flexShrink: 0,
          }}
        >
          {expanded ? 'Hide' : 'Show QR'}
        </button>
      </div>

      {expanded && (
        <>
          {/* Stub divider — same dashed line + 8px dot used on fan tickets */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 1.3rem' }}>
            <div style={{ flex: 1, borderTop: `1.5px dashed ${C.border}` }} />
            <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: C.bg, border: `1px solid ${C.border}`, flexShrink: 0, margin: '0 -7px', position: 'relative', left: '-7px' }} />
            <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: C.bg, border: `1px solid ${C.border}`, flexShrink: 0, margin: '0 -7px', position: 'relative', right: '-7px' }} />
            <div style={{ flex: 1, borderTop: `1.5px dashed ${C.border}` }} />
          </div>

          <div style={{
            padding: '1.4rem 1.3rem 1.6rem',
            display: 'flex', justifyContent: 'center',
          }}>
            <div style={{
              padding: '1rem',
              background: '#fff',
              borderRadius: '14px',
              boxShadow: `0 0 0 1px ${BRAND.pink}33, 0 12px 32px rgba(221,34,170,0.18)`,
            }}>
              <QRCode
                value={url}
                size={220}
                quietZone={6}
                ecLevel="M"
                qrStyle="squares"
                eyeRadius={6}
                bgColor="#ffffff"
                fgColor="#08080c"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
