// Stylized CDMX map + three-point pitch shown to prospective artists in
// the Artist tab's Apply flow (LandingPortal). 40 sample followers, each
// with their own listening radius. Highlights which would receive a
// notification when "your show" lands at the venue pin (Roma-ish).
//
// The visual sells three things:
//   1. Privacy: we only message followers whose radius covers the venue
//   2. Permanence: each show recruits followers you keep forever
//   3. Discoverability: promoters find you by local follower density

import React from 'react'
import { BRAND, C, FONT } from './theme'

const W = 380
const H = 280
const VENUE = { x: 195, y: 145 }

const NEIGHBORHOODS = [
  { x: 130, y: 60,  label: 'Polanco' },
  { x: 220, y: 105, label: 'Centro' },
  { x: 165, y: 158, label: 'Condesa' },
  { x: 220, y: 220, label: 'Coyoacán' },
  { x: 80,  y: 165, label: 'Santa Fe' },
  { x: 285, y: 175, label: 'Iztapalapa' },
  { x: 220, y: 258, label: 'Tlalpan' },
  { x: 220, y: 70,  label: 'Lindavista' },
]

// Deterministic 40 followers. Positions in viewport pixels, radii in
// viewport pixels (≈ each follower's preferred listening range).
// Mix designed to land ~half receiving the venue's notification.
const FOLLOWERS = [
  // close to venue — small radius, all receive
  { x: 188, y: 140, r: 25 },
  { x: 200, y: 152, r: 30 },
  { x: 175, y: 160, r: 35 },
  { x: 210, y: 130, r: 40 },
  { x: 195, y: 165, r: 28 },
  { x: 180, y: 145, r: 22 },
  { x: 195, y: 130, r: 20 },
  { x: 210, y: 160, r: 35 },
  { x: 180, y: 175, r: 40 },
  { x: 215, y: 135, r: 30 },
  // mid-range — varies
  { x: 150, y: 90,  r: 70 },
  { x: 240, y: 100, r: 65 },
  { x: 165, y: 200, r: 60 },
  { x: 130, y: 130, r: 90 },
  { x: 230, y: 175, r: 70 },
  { x: 240, y: 140, r: 55 },
  { x: 200, y: 110, r: 60 },
  { x: 175, y: 110, r: 45 },
  { x: 215, y: 195, r: 55 },
  { x: 250, y: 130, r: 50 },
  { x: 160, y: 175, r: 60 },
  { x: 220, y: 165, r: 50 },
  // far w/ small radius — never receive (live in their own bubble)
  { x: 80,  y: 130, r: 30 },
  { x: 90,  y: 170, r: 25 },
  { x: 70,  y: 110, r: 35 },
  { x: 290, y: 180, r: 30 },
  { x: 305, y: 165, r: 25 },
  { x: 280, y: 200, r: 30 },
  { x: 220, y: 250, r: 35 },
  { x: 200, y: 260, r: 30 },
  { x: 240, y: 240, r: 30 },
  { x: 140, y: 220, r: 30 },
  { x: 175, y: 240, r: 35 },
  { x: 220, y: 70,  r: 40 },
  { x: 190, y: 60,  r: 35 },
  { x: 165, y: 80,  r: 35 },
  // far w/ big radius — receive
  { x: 290, y: 100, r: 110 },
  { x: 80,  y: 200, r: 130 },
  { x: 100, y: 80,  r: 100 },
  { x: 290, y: 230, r: 120 },
]

const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)

const POINTS = [
  {
    icon: '📍',
    title: 'Only messages the people who asked.',
    desc: "Every follower picks their own radius when they sign up. If your show is outside it, they don't hear about it. Grail will never spam on your behalf — the platform won't reach beyond what each person agreed to.",
  },
  {
    icon: '♾',
    title: 'Every show recruits followers for life.',
    desc: "Each fan who follows you at one of your Grail shows stays followed. The next time you play CDMX — same venue or a different one — they're already on the list. The audience compounds with every gig.",
  },
  {
    icon: '🔍',
    title: 'Promoters find you by local density.',
    desc: 'When a promoter is building a lineup, they can search Grail for the artists with the most followers near their venue. The bigger your local following, the more bookings come to you instead of the other way around.',
  },
]

export default function ArtistMap() {
  const active   = FOLLOWERS.filter(f => dist(f, VENUE) <= f.r)
  const inactive = FOLLOWERS.filter(f => dist(f, VENUE) >  f.r)

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {/* The map */}
      <div style={{
        background: '#0a0a10', border: `1px solid ${C.border}`, borderRadius: '14px',
        padding: '0.85rem 0.85rem 0.7rem', overflow: 'hidden', position: 'relative',
      }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
          <defs>
            <pattern id="grailGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#15151f" strokeWidth="0.5" />
            </pattern>
            <radialGradient id="venueGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor={BRAND.neon} stopOpacity="0.55" />
              <stop offset="100%" stopColor={BRAND.neon} stopOpacity="0" />
            </radialGradient>
            <radialGradient id="cityGlow" cx="50%" cy="55%" r="50%">
              <stop offset="0%"   stopColor="#1a1428" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#0a0a10" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Ambient city glow + grid */}
          <rect width={W} height={H} fill="url(#cityGlow)" />
          <rect width={W} height={H} fill="url(#grailGrid)" />

          {/* Neighborhood labels (subtle, monospace) */}
          {NEIGHBORHOODS.map(n => (
            <text
              key={n.label}
              x={n.x} y={n.y}
              fill="#2e2840" fontSize="7" fontFamily="ui-monospace, monospace"
              textAnchor="middle" letterSpacing="0.1em"
            >
              {n.label.toUpperCase()}
            </text>
          ))}

          {/* Inactive followers: faint radius + dim dot. Their bubble doesn't
              reach the venue — they don't get pinged. */}
          {inactive.map((f, i) => (
            <g key={`i-${i}`}>
              <circle
                cx={f.x} cy={f.y} r={f.r}
                fill="none" stroke="#2a2438" strokeWidth="0.5"
                strokeDasharray="2,3" strokeOpacity="0.5"
              />
              <circle cx={f.x} cy={f.y} r="2.2" fill="#5a5068" />
            </g>
          ))}

          {/* Active followers: bright radius + dot + thin line to venue. Their
              bubble covers your show — they get the email. */}
          {active.map((f, i) => (
            <g key={`a-${i}`}>
              <circle
                cx={f.x} cy={f.y} r={f.r}
                fill="none" stroke={BRAND.neon} strokeWidth="0.7" strokeOpacity="0.35"
              />
              <line
                x1={f.x} y1={f.y} x2={VENUE.x} y2={VENUE.y}
                stroke={BRAND.neon} strokeWidth="0.5" strokeOpacity="0.35"
              />
              <circle cx={f.x} cy={f.y} r="3" fill={BRAND.neon} />
            </g>
          ))}

          {/* Venue glow + pin */}
          <circle cx={VENUE.x} cy={VENUE.y} r="42" fill="url(#venueGlow)" />
          <circle cx={VENUE.x} cy={VENUE.y} r="7" fill={BRAND.pink} />
          <circle cx={VENUE.x} cy={VENUE.y} r="7" fill="none" stroke="#fff" strokeWidth="1.2" strokeOpacity="0.9" />
          <text
            x={VENUE.x} y={VENUE.y - 13}
            fill="#fff" fontSize="8.5" fontWeight="800"
            fontFamily="ui-monospace, monospace" letterSpacing="0.18em" textAnchor="middle"
          >
            YOUR SHOW
          </text>
        </svg>

        {/* Live count caption */}
        <div style={{ marginTop: '0.5rem', color: C.textMid, fontSize: '0.78rem', lineHeight: 1.5, textAlign: 'center', padding: '0 0.4rem' }}>
          <strong style={{ color: BRAND.neon }}>{active.length}</strong> of <strong style={{ color: C.text }}>{FOLLOWERS.length}</strong> followers get the email — only the ones whose listening radius covers your venue.
        </div>
      </div>

      {/* The three-point pitch underneath */}
      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {POINTS.map(p => (
          <div
            key={p.title}
            style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px',
              padding: '1rem 1.15rem', display: 'flex', gap: '0.8rem', alignItems: 'flex-start',
            }}
          >
            <div style={{ fontSize: '1.4rem', lineHeight: 1, flexShrink: 0, marginTop: '0.05rem' }}>{p.icon}</div>
            <div>
              <div style={{ color: C.text, fontWeight: 800, fontSize: '0.92rem', marginBottom: '0.25rem', letterSpacing: '-0.01em' }}>
                {p.title}
              </div>
              <div style={{ color: C.textMid, fontSize: '0.83rem', lineHeight: 1.55 }}>
                {p.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
