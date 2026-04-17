// ─── GRAIL DESIGN SYSTEM ──────────────────────────────────────────────────────
// Extracted from GrailDemo/AlleycatDemo — single source of truth for the app.

export const BRAND = {
  gradient:      'linear-gradient(135deg, #dd22aa 0%, #f07020 100%)',
  gradientAngle: 'linear-gradient(160deg, #dd22aa, #f07020)',
  pink:    '#dd22aa',
  orange:  '#f07020',
  neon:    '#aaff00',   // chartreuse — success/connected/live
  purple:  '#b57bff',   // accent for fan-side
  blue:    '#5b9bff',   // accent for demos/info
}

export const C = {
  bg:       '#08080c',
  surface:  '#0e0e14',
  card:     '#12121a',
  cardHov:  '#161622',
  border:   '#1e1e2a',
  borderHi: '#2a2a3a',
  text:     '#e8e0d0',
  textMid:  '#8a8098',
  textDim:  '#3a3448',
  green:    '#22c55e',
  red:      '#ef4444',
}

// Shared font stack — use everywhere
export const FONT = 'system-ui, -apple-system, sans-serif'

// ─── COMMON STYLES ────────────────────────────────────────────────────────────

export const INPUT = {
  width: '100%',
  background: '#0d0d14',
  border: `1px solid ${C.border}`,
  borderRadius: '10px',
  padding: '0.8rem 1rem',
  color: C.text,
  fontSize: '0.95rem',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: FONT,
}

export const PRIMARY_BTN = {
  background: BRAND.gradient,
  color: '#000',
  border: 'none',
  borderRadius: '10px',
  padding: '0.9rem 1.5rem',
  fontWeight: '800',
  fontSize: '0.95rem',
  cursor: 'pointer',
  fontFamily: FONT,
  letterSpacing: '0.01em',
}

export const SECONDARY_BTN = {
  background: 'transparent',
  color: C.textMid,
  border: `1px solid ${C.border}`,
  borderRadius: '10px',
  padding: '0.85rem 1.5rem',
  fontSize: '0.9rem',
  cursor: 'pointer',
  fontFamily: FONT,
}

export const CARD = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: '14px',
}

// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────

// Small uppercase pink "eyebrow" label above titles
export function eyebrowStyle(color = BRAND.pink) {
  return {
    fontSize: '0.72rem',
    color,
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    fontWeight: '700',
    marginBottom: '0.5rem',
  }
}

// Circular GRAIL logo — gradient ring with black text
export function LogoMark({ size = 72 }) {
  const fontSize = size * 0.22
  return {
    width: size,
    height: size,
    borderRadius: '50%',
    background: BRAND.gradient,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontFamily: FONT,
    fontSize,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: '-0.02em',
  }
}

// Pill badge — used for status indicators
export function badgeStyle(variant = 'neutral') {
  const variants = {
    live:    { bg: '#1a1000', color: BRAND.orange, border: `1px solid ${BRAND.orange}44` },
    success: { bg: BRAND.neon + '18', color: BRAND.neon, border: `1px solid ${BRAND.neon}44` },
    draft:   { bg: '#1a0d00', color: BRAND.orange, border: '1px solid #6b4a14' },
    neutral: { bg: '#1a1a2a', color: C.textMid, border: `1px solid ${C.border}` },
  }
  const v = variants[variant] || variants.neutral
  return {
    display: 'inline-block',
    fontSize: '0.68rem',
    padding: '0.2rem 0.6rem',
    borderRadius: '99px',
    fontWeight: '700',
    letterSpacing: '0.06em',
    background: v.bg,
    color: v.color,
    border: v.border,
  }
}

// Page wrapper — consistent bg, font, min-height
export const PAGE = {
  minHeight: '100vh',
  background: C.bg,
  color: C.text,
  fontFamily: FONT,
}
