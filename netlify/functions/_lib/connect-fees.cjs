// Stripe Connect fee math for destination charges.
//
// In a destination charge (transfer_data.destination + application_fee_amount),
// Stripe's processing fee comes out of the PLATFORM's balance by default.
// To pass that fee through to the connected account (the promoter), we bump
// application_fee_amount by an estimate of the Stripe fee, so the platform
// recoups it.
//
// Net flow per $100 charge (MX domestic card, 3.6% + 3 MXN ≈ $0.18):
//   - Buyer pays $100
//   - Stripe deducts $3.78 from platform balance
//   - application_fee_amount = $5.78  (2% platform + 3.6% stripe + $0.18)
//   - Connected account receives $94.22
//   - Platform net: $5.78 - $3.78 = $2.00  (the intended 2% take)
//
// Foreign cards (4.6% MX rate) cost the platform a few cents per $100 vs
// estimate. Buffer is in STRIPE_FEE_PASSTHROUGH_BPS = 380 (3.8%) to absorb
// most of that variance. Override via env var if your card mix shifts.

const PLATFORM_FEE_BPS       = Number(process.env.GRAIL_PLATFORM_FEE_BPS               || 200)  // 2.0%
const STRIPE_FEE_BPS         = Number(process.env.STRIPE_FEE_PASSTHROUGH_BPS           || 380)  // 3.8%
const STRIPE_FEE_FIXED_CENTS = Number(process.env.STRIPE_FEE_PASSTHROUGH_FIXED_CENTS   || 300)  // 3 MXN

function applicationFeeFor(amountCents) {
  const amount = Math.max(0, Math.floor(Number(amountCents) || 0))
  return Math.round((amount * (PLATFORM_FEE_BPS + STRIPE_FEE_BPS)) / 10000) + STRIPE_FEE_FIXED_CENTS
}

module.exports = {
  applicationFeeFor,
  PLATFORM_FEE_BPS,
  STRIPE_FEE_BPS,
  STRIPE_FEE_FIXED_CENTS,
}
