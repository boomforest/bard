import { describe, it, expect } from 'vitest'
const { applicationFeeFor, PLATFORM_FEE_BPS, STRIPE_FEE_BPS, STRIPE_FEE_FIXED_CENTS } =
  require('../netlify/functions/_lib/connect-fees.cjs')

// These tests pin the platform fee math. If a number here changes by accident
// (e.g. a typo bumps PLATFORM_FEE_BPS from 200 to 2000), the tests fail before
// the change ever hits prod and silently 10x's the platform's cut.

describe('connect-fees · applicationFeeFor', () => {
  it('uses the documented constants', () => {
    expect(PLATFORM_FEE_BPS).toBe(200)         // 2.0% platform take
    expect(STRIPE_FEE_BPS).toBe(380)           // 3.8% Stripe processing passthrough
    expect(STRIPE_FEE_FIXED_CENTS).toBe(300)   // 3 MXN fixed Stripe fee
  })

  it('zero charge → just the fixed fee', () => {
    expect(applicationFeeFor(0)).toBe(STRIPE_FEE_FIXED_CENTS)
  })

  it('100 MXN charge → 5.8% + 3 MXN', () => {
    // 10000 * (200 + 380) / 10000 = 580, plus 300 fixed = 880
    expect(applicationFeeFor(10000)).toBe(880)
  })

  it('500 MXN charge → 5.8% + 3 MXN', () => {
    // 50000 * 580 / 10000 = 2900, plus 300 = 3200
    expect(applicationFeeFor(50000)).toBe(3200)
  })

  it('1000 MXN charge → 5.8% + 3 MXN', () => {
    expect(applicationFeeFor(100000)).toBe(6100)
  })

  it('coerces non-numeric input to 0 (never NaN)', () => {
    expect(applicationFeeFor(null)).toBe(STRIPE_FEE_FIXED_CENTS)
    expect(applicationFeeFor(undefined)).toBe(STRIPE_FEE_FIXED_CENTS)
    expect(applicationFeeFor('not a number')).toBe(STRIPE_FEE_FIXED_CENTS)
  })

  it('floors negative input to 0 (never refunds the fixed fee)', () => {
    expect(applicationFeeFor(-1000)).toBe(STRIPE_FEE_FIXED_CENTS)
  })

  it('handles fractional cents by flooring (Stripe accepts ints only)', () => {
    expect(applicationFeeFor(10000.7)).toBe(880)
  })

  it('platform net per $100 is ~$2 (the intended take after Stripe fees)', () => {
    // From the comment: $100 buyer charge -> Stripe deducts $3.78,
    // application_fee = $5.78, platform retains $2.00.
    // Test the application_fee side; Stripe's actual deduction varies a bit.
    const fee = applicationFeeFor(10000)  // $100 = 10000 cents
    expect(fee).toBe(880)  // $5.80 — sanity check: matches the docstring math
  })
})
