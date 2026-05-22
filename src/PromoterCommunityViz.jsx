// "Your scene" visualization for the Promoter tab Apply flow. Shows the
// promoter at the center, satellites for each artist they've booked,
// follower clusters around each artist, all radiating out into a
// total-reach number. Sells the compounding-community-from-booking story
// without naming any features.

import React from 'react'
import { BRAND, C, FONT } from './theme'

const W = 380
const H = 290
const CENTER = { x: 190, y: 152 }

// Seven artists arrayed around the promoter, each with a follower count.
// Numbers chosen to feel scene-realistic (a few headliners with bigger
// audiences, a couple of up-and-comers with smaller ones).
const ARTISTS = [
  { angle: -Math.PI / 2,           dist: 70, name: 'Hilda',          fans: 312 },
  { angle: -Math.PI / 2 + 2*Math.PI/7,  dist: 80, name: 'Tropico',        fans: 187 },
  { angle: -Math.PI / 2 + 4*Math.PI/7,  dist: 75, name: 'Wasted Fates',   fans: 224 },
  { angle: -Math.PI / 2 + 6*Math.PI/7,  dist: 82, name: 'Lechuga Z.',     fans: 145 },
  { angle: -Math.PI / 2 + 8*Math.PI/7,  dist: 70, name: 'Voiski',         fans: 268 },
  { angle: -Math.PI / 2 + 10*Math.PI/7, dist: 78, name: 'Mar Adentro',    fans:  92 },
  { angle: -Math.PI / 2 + 12*Math.PI/7, dist: 75, name: 'Daniela L.',     fans: 196 },
]

const TOTAL_FANS = ARTISTS.reduce((s, a) => s + a.fans, 0)

// Compute artist positions on the canvas
const positioned = ARTISTS.map(a => ({
  ...a,
  x: CENTER.x + Math.cos(a.angle) * a.dist,
  y: CENTER.y + Math.sin(a.angle) * a.dist,
}))

// Pseudo-random but deterministic follower dots around each artist node.
// We don't draw `a.fans` dots literally — that's too many. We draw a
// representative cluster (8–14 dots) per artist sized to suggest scale.
function followerDotsFor(artist, idx) {
  const count = Math.min(14, Math.max(5, Math.round(artist.fans / 25)))
  const dots = []
  for (let i = 0; i < count; i++) {
    // Deterministic angle + jitter based on index for stability
    const a = (i / count) * Math.PI * 2 + idx * 0.7
    const r = 12 + ((i * 17 + idx * 11) % 14)
    dots.push({
      x: artist.x + Math.cos(a) * r,
      y: artist.y + Math.sin(a) * r,
    })
  }
  return dots
}

const POINTS = [
  {
    icon: '🎭',
    title: 'Your community, not a feed.',
    desc: "When fans follow you on Grail, they're following you directly — not an algorithm. The next show you throw, they hear about it. We never surface other promoters' shows to your audience. The relationships you build stay yours, for life.",
  },
  {
    icon: '🌱',
    title: 'Develop local talent.',
    desc: "Every artist you book grows their reach because of the night you gave them — and they keep those new followers forever. Six months from now, when an artist says 'this promoter put me on,' that's your reputation. The best promoters in any city are the ones whose roster's careers credit them.",
  },
  {
    icon: '🤝',
    title: 'Fair money, zero spreadsheet drama.',
    desc: "Everyone signs the budget before tickets open. After the show, the money distributes automatically based on what everyone agreed to — no 'I forgot we agreed to that' moments. The boring stuff handles itself; the booking and the curation stay human.",
  },
]

export default function PromoterCommunityViz() {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{
        background: '#0a0a10', border: `1px solid ${C.border}`, borderRadius: '14px',
        padding: '0.85rem 0.85rem 0.7rem', position: 'relative', overflow: 'hidden',
      }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
          <defs>
            <radialGradient id="promoterCenterGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor={BRAND.orange} stopOpacity="0.45" />
              <stop offset="100%" stopColor={BRAND.orange} stopOpacity="0" />
            </radialGradient>
            <radialGradient id="reachGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor={BRAND.pink} stopOpacity="0.05" />
              <stop offset="80%"  stopColor={BRAND.pink} stopOpacity="0.02" />
              <stop offset="100%" stopColor={BRAND.pink} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Aggregate-reach ring (the community that exists because you booked) */}
          <circle cx={CENTER.x} cy={CENTER.y} r="135" fill="url(#reachGlow)" />
          <circle cx={CENTER.x} cy={CENTER.y} r="135" fill="none" stroke={BRAND.pink} strokeWidth="0.6" strokeOpacity="0.25" strokeDasharray="3,5" />

          {/* Lines from promoter to each artist */}
          {positioned.map((a, i) => (
            <line
              key={`l-${i}`}
              x1={CENTER.x} y1={CENTER.y} x2={a.x} y2={a.y}
              stroke={BRAND.orange} strokeOpacity="0.35" strokeWidth="0.7"
            />
          ))}

          {/* Follower clusters around each artist */}
          {positioned.map((a, i) => (
            <g key={`f-${i}`}>
              {followerDotsFor(a, i).map((d, j) => (
                <circle
                  key={j}
                  cx={d.x} cy={d.y} r="1.6"
                  fill={BRAND.pink} fillOpacity="0.6"
                />
              ))}
            </g>
          ))}

          {/* Artist nodes + labels */}
          {positioned.map((a, i) => (
            <g key={`a-${i}`}>
              <circle cx={a.x} cy={a.y} r="6" fill={BRAND.neon} />
              <circle cx={a.x} cy={a.y} r="6" fill="none" stroke="#0a0a10" strokeWidth="1.5" />
              <text
                x={a.x} y={a.y + 20}
                fill={C.text} fontSize="9" fontWeight="700"
                fontFamily="ui-monospace, monospace" textAnchor="middle"
              >
                {a.name}
              </text>
              <text
                x={a.x} y={a.y + 30}
                fill={C.textMid} fontSize="7.5"
                fontFamily="ui-monospace, monospace" textAnchor="middle"
              >
                {a.fans} fans
              </text>
            </g>
          ))}

          {/* Promoter node at center */}
          <circle cx={CENTER.x} cy={CENTER.y} r="45" fill="url(#promoterCenterGlow)" />
          <circle cx={CENTER.x} cy={CENTER.y} r="11" fill={BRAND.orange} />
          <circle cx={CENTER.x} cy={CENTER.y} r="11" fill="none" stroke="#fff" strokeWidth="1.4" strokeOpacity="0.9" />
          <text
            x={CENTER.x} y={CENTER.y - 19}
            fill="#fff" fontSize="8.5" fontWeight="800"
            fontFamily="ui-monospace, monospace" letterSpacing="0.16em" textAnchor="middle"
          >
            YOUR SCENE
          </text>
        </svg>

        {/* Reach total caption */}
        <div style={{
          marginTop: '0.5rem', color: C.textMid, fontSize: '0.78rem',
          lineHeight: 1.5, textAlign: 'center', padding: '0 0.4rem',
        }}>
          Book <strong style={{ color: BRAND.neon }}>{ARTISTS.length}</strong> acts this year — reach <strong style={{ color: C.text }}>{TOTAL_FANS.toLocaleString()}</strong> fans who now know your venue, your taste, your scene.
        </div>
      </div>

      {/* Three-point pitch */}
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
