import React from 'react'
import { useLocale } from './i18n'
import { C, FONT } from './theme'

// Two-pill EN / ES toggle. Drop into any page header. Keeps shape
// identical on both states so it doesn't reflow when toggled.
export default function LocaleToggle({ style }) {
  const { locale, setLocale } = useLocale()
  return (
    <div style={{
      display: 'inline-flex',
      border: `1px solid ${C.border}`,
      borderRadius: '8px',
      overflow: 'hidden',
      ...style,
    }}>
      {['es', 'en'].map(l => {
        const active = locale === l
        return (
          <button
            key={l}
            onClick={() => setLocale(l)}
            aria-pressed={active}
            style={{
              background: active ? C.text : 'transparent',
              color:      active ? '#000' : C.textMid,
              border: 'none',
              padding: '0.3rem 0.6rem',
              cursor: 'pointer',
              fontFamily: FONT,
              fontWeight: '800',
              fontSize: '0.7rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              lineHeight: 1,
            }}
          >
            {l}
          </button>
        )
      })}
    </div>
  )
}
