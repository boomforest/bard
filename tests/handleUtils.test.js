import { describe, it, expect } from 'vitest'
import { validateHandle, RESERVED_HANDLES } from '../src/handleUtils.js'

describe('validateHandle', () => {
  describe('happy path', () => {
    it('accepts simple lowercase handles', () => {
      expect(validateHandle('casadecopas')).toEqual({ ok: true, handle: 'casadecopas' })
      expect(validateHandle('jp')).toEqual({ ok: true, handle: 'jp' })
    })
    it('accepts handles with hyphens in the middle', () => {
      expect(validateHandle('casa-de-copas')).toEqual({ ok: true, handle: 'casa-de-copas' })
    })
    it('accepts handles with digits', () => {
      expect(validateHandle('grail2026')).toEqual({ ok: true, handle: 'grail2026' })
      expect(validateHandle('2pac')).toEqual({ ok: true, handle: '2pac' })
    })
    it('lowercases input', () => {
      expect(validateHandle('CASADECOPAS')).toEqual({ ok: true, handle: 'casadecopas' })
      expect(validateHandle('  CasaDeCopas  ')).toEqual({ ok: true, handle: 'casadecopas' })
    })
  })

  describe('rejection cases', () => {
    it('rejects empty input', () => {
      expect(validateHandle('').ok).toBe(false)
      expect(validateHandle(null).ok).toBe(false)
      expect(validateHandle(undefined).ok).toBe(false)
      expect(validateHandle('   ').ok).toBe(false)
    })
    it('rejects too short (< 2 chars)', () => {
      const r = validateHandle('a')
      expect(r.ok).toBe(false)
      expect(r.reason).toMatch(/short/i)
    })
    it('rejects too long (> 30 chars)', () => {
      const r = validateHandle('a'.repeat(31))
      expect(r.ok).toBe(false)
      expect(r.reason).toMatch(/long/i)
    })
    it('rejects leading hyphen', () => {
      expect(validateHandle('-foo').ok).toBe(false)
    })
    it('rejects trailing hyphen', () => {
      expect(validateHandle('foo-').ok).toBe(false)
    })
    it('rejects uppercase that survives lowercasing — never mind, lowercasing always wins', () => {
      // After lowercase it's valid; this confirms the lowercase happens before validation
      expect(validateHandle('FOO').ok).toBe(true)
    })
    it('rejects special characters', () => {
      expect(validateHandle('foo bar').ok).toBe(false)
      expect(validateHandle('foo.bar').ok).toBe(false)
      expect(validateHandle('foo_bar').ok).toBe(false)
      expect(validateHandle('foo@bar').ok).toBe(false)
    })
    it('rejects accented / unicode characters', () => {
      expect(validateHandle('café').ok).toBe(false)
      expect(validateHandle('ñoño').ok).toBe(false)
    })
  })

  describe('reserved handles', () => {
    it('rejects every entry in RESERVED_HANDLES', () => {
      for (const reserved of RESERVED_HANDLES) {
        const r = validateHandle(reserved)
        expect(r.ok, `expected reserved handle "${reserved}" to be rejected`).toBe(false)
      }
    })
    it('rejects every top-level route as a handle', () => {
      // If this fails, somebody added a route to main.jsx without adding it
      // to RESERVED_HANDLES — risk: a promoter claims a handle that breaks
      // the app routing.
      const knownRoutes = ['admin', 'promoter', 'scan', 'demo', 'bar', 'join', 'terms', 'me', 'setup']
      for (const route of knownRoutes) {
        expect(validateHandle(route).ok).toBe(false)
      }
    })
  })
})
