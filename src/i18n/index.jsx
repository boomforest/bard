// Lightweight i18n — no library. Provider + useT() hook + locale toggle.
//
// Default ES (CDMX-first). EN available via header toggle. localStorage
// persists the choice; browser language is the fallback when nothing
// is saved yet.

import React, { createContext, useContext, useState, useCallback } from 'react'
import en from './en'
import es from './es'

const DICTS = { en, es }
const STORAGE_KEY = 'grail.locale'

const detectInitial = () => {
  if (typeof window === 'undefined') return 'es'
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'es') return saved
  } catch {}
  const nav = (typeof navigator !== 'undefined' && navigator.language || '').toLowerCase()
  if (nav.startsWith('en')) return 'en'
  return 'es'
}

const LocaleContext = createContext({ locale: 'es', setLocale: () => {} })

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(detectInitial)

  const setLocale = useCallback((next) => {
    if (next !== 'en' && next !== 'es') return
    setLocaleState(next)
    try { window.localStorage.setItem(STORAGE_KEY, next) } catch {}
    try { document.documentElement.lang = next } catch {}
  }, [])

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  )
}

export const useLocale = () => useContext(LocaleContext)

// useT returns a translator function. Looks up `key` in the active
// dictionary, falls back to EN, then to the key itself if neither has
// it. Supports {var} interpolation: t('foo.bar', { count: 3 }).
export function useT() {
  const { locale } = useLocale()
  return useCallback((key, vars) => {
    const primary = DICTS[locale] || DICTS.es
    let s = primary[key]
    if (s == null) s = DICTS.en[key]
    if (s == null) s = key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      }
    }
    return s
  }, [locale])
}
