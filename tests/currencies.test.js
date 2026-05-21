import { describe, it, expect } from 'vitest'
import { CURRENCIES, DEFAULT_CURRENCY, symbolFor, fmtPrice, fmtPriceCents } from '../src/currencies.js'

describe('currencies', () => {
  describe('CURRENCIES list', () => {
    it('has every code in lowercase 3-letter ISO format', () => {
      for (const c of CURRENCIES) {
        expect(c.code).toMatch(/^[a-z]{3}$/)
      }
    })
    it('includes the platform default', () => {
      expect(CURRENCIES.find(c => c.code === DEFAULT_CURRENCY)).toBeTruthy()
    })
    it('default is mxn (CDMX-first platform)', () => {
      expect(DEFAULT_CURRENCY).toBe('mxn')
    })
  })

  describe('symbolFor', () => {
    it('returns the expected symbol for known codes', () => {
      expect(symbolFor('mxn')).toBe('$')
      expect(symbolFor('eur')).toBe('€')
      expect(symbolFor('gbp')).toBe('£')
      expect(symbolFor('jpy')).toBe('¥')
      expect(symbolFor('brl')).toBe('R$')
    })
    it('case-insensitive', () => {
      expect(symbolFor('MXN')).toBe('$')
      expect(symbolFor('Eur')).toBe('€')
    })
    it('falls back to $ for unknown codes', () => {
      expect(symbolFor('xxx')).toBe('$')
      expect(symbolFor(null)).toBe('$')
      expect(symbolFor(undefined)).toBe('$')
      expect(symbolFor('')).toBe('$')
    })
  })

  describe('fmtPrice', () => {
    it('formats whole-currency amounts with 3-letter code', () => {
      expect(fmtPrice(50, 'mxn')).toBe('50 MXN')
      expect(fmtPrice(1500, 'usd')).toBe('1,500 USD')
    })
    it('rounds non-integer cents to 2 decimal places (avoiding .999...)', () => {
      expect(fmtPrice(12.5, 'usd')).toBe('12.5 USD')
      expect(fmtPrice(12.345, 'usd')).toBe('12.35 USD')
    })
    it('defaults to MXN when no currency given', () => {
      expect(fmtPrice(100)).toBe('100 MXN')
    })
    it('coerces non-numeric to 0', () => {
      expect(fmtPrice(null)).toBe('0 MXN')
      expect(fmtPrice('not a number')).toBe('0 MXN')
    })
    it('uses uppercase ISO code (Stripe expects lowercase but display is upper)', () => {
      expect(fmtPrice(10, 'eur')).toBe('10 EUR')
      expect(fmtPrice(10, 'EUR')).toBe('10 EUR')
    })
  })

  describe('fmtPriceCents', () => {
    it('converts cents to whole-currency for display', () => {
      expect(fmtPriceCents(5000, 'mxn')).toBe('50 MXN')
      expect(fmtPriceCents(150000, 'usd')).toBe('1,500 USD')
    })
    it('handles fractional cents (rounds to 2 decimals)', () => {
      expect(fmtPriceCents(1234, 'usd')).toBe('12.34 USD')
    })
    it('zero / null safe', () => {
      expect(fmtPriceCents(0, 'mxn')).toBe('0 MXN')
      expect(fmtPriceCents(null, 'mxn')).toBe('0 MXN')
    })
  })
})
