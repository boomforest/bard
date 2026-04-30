// Currencies the platform offers for event pricing.
// Latin-America-leaning since the platform is based in CDMX, plus the
// majors that Stripe Connect supports out of the box.
//
// Code is the lowercase 3-letter ISO 4217 string Stripe expects in API calls
// (and what we store in events.currency).

export const CURRENCIES = [
  { code: 'mxn', label: 'MXN — Mexican Peso',     symbol: '$' },
  { code: 'usd', label: 'USD — US Dollar',        symbol: '$' },
  { code: 'eur', label: 'EUR — Euro',             symbol: '€' },
  { code: 'gbp', label: 'GBP — British Pound',    symbol: '£' },
  { code: 'cad', label: 'CAD — Canadian Dollar',  symbol: '$' },
  { code: 'aud', label: 'AUD — Australian Dollar',symbol: '$' },
  { code: 'brl', label: 'BRL — Brazilian Real',   symbol: 'R$' },
  { code: 'ars', label: 'ARS — Argentine Peso',   symbol: '$' },
  { code: 'cop', label: 'COP — Colombian Peso',   symbol: '$' },
  { code: 'jpy', label: 'JPY — Japanese Yen',     symbol: '¥' },
]

export const DEFAULT_CURRENCY = 'mxn'

export function symbolFor(code) {
  return CURRENCIES.find(c => c.code === (code || '').toLowerCase())?.symbol || '$'
}

// Format a price as "1,500 MXN" — number + 3-letter code, no symbol.
// Why no symbol: $ is shared by US/MX/CA/AU/AR/CO and creates dangerous
// ambiguity in a multi-currency platform ($50 MXN ≠ $50 USD by ~17×).
// The 3-letter code is unambiguous and locale-neutral.
//
// `amount` is a whole-currency number (50 means 50 pesos / 50 dollars).
// For cents, use fmtPriceCents().
export function fmtPrice(amount, currency = DEFAULT_CURRENCY) {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase()
  const n = Number(amount) || 0
  const rounded = Number.isInteger(n) ? n : Math.round(n * 100) / 100
  return `${rounded.toLocaleString()} ${code}`
}

export function fmtPriceCents(cents, currency = DEFAULT_CURRENCY) {
  return fmtPrice((Number(cents) || 0) / 100, currency)
}
