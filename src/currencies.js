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
