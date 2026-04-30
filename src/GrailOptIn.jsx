import React from 'react'
import { useT } from './i18n'
import { BRAND, C, FONT } from './theme'

// Reusable opt-in checkbox for the platform-level Grail subscriber
// list. Drop into any buyer form alongside the primary submit action;
// parent owns the `checked` state and is responsible for calling
// subscribeToGrail() in eventService when checked.
export default function GrailOptIn({ checked, onChange, style }) {
  const t = useT()
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.55rem',
        cursor: 'pointer',
        padding: '0.35rem 0',
        ...style,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{
          marginTop: '2px',
          accentColor: BRAND.pink,
          flexShrink: 0,
          cursor: 'pointer',
        }}
      />
      <span style={{
        color: C.textMid,
        fontSize: '0.78rem',
        lineHeight: 1.45,
        fontFamily: FONT,
      }}>
        {t('grailOptIn.label')}
      </span>
    </label>
  )
}
