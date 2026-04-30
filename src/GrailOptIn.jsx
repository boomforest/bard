import React from 'react'
import { useT } from './i18n'
import { BRAND, C, FONT, INPUT } from './theme'

// Reusable opt-in for the Grail+ subscriber lists. Drop into any buyer
// form alongside the primary submit action; parent owns the `checked`
// + zip/radius state and is responsible for calling
// subscribeToLists() in eventService when checked.
//
// `hideLocation` lets a parent (e.g. FollowPromoter) skip the zip
// input when it's already collecting that data on its own form.
export default function GrailOptIn({
  checked,
  onChange,
  zip,
  setZip,
  radius,
  setRadius,
  hideLocation = false,
  style,
}) {
  const t = useT()

  return (
    <div style={style}>
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.55rem',
          cursor: 'pointer',
          padding: '0.35rem 0',
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

      {checked && !hideLocation && (
        <div style={{ paddingLeft: '1.65rem', marginTop: '0.45rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <input
            style={{ ...INPUT, fontSize: '0.85rem', padding: '0.65rem 0.85rem' }}
            type="text"
            placeholder={t('grailOptIn.zipPh')}
            value={zip}
            onChange={e => setZip(e.target.value)}
            inputMode="numeric"
            autoComplete="postal-code"
          />
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {[10, 25, 50, 100].map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setRadius(r)}
                style={{
                  flex: 1, padding: '0.45rem 0', borderRadius: '7px',
                  border: `1px solid ${radius === r ? BRAND.pink : C.border}`,
                  background: radius === r ? 'rgba(221,34,170,0.1)' : 'transparent',
                  color: radius === r ? BRAND.pink : C.textMid,
                  cursor: 'pointer', fontSize: '0.74rem', fontWeight: '700',
                  fontFamily: FONT,
                }}
              >
                {r}mi
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
