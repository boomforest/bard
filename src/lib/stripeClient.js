// Shared Stripe.js loader for any component that needs Stripe Elements.
//
// Why lazy: calling loadStripe() at module-import time fires Stripe's
// script tag on every page in the bundle — including pages that never
// touch payments (home, /me, etc.). When tracker blockers (very common
// on Android Chrome) block js.stripe.com, the load promise rejects,
// no checkout flow is awaiting it, and it bubbles up as an
// unhandled-rejection logged to the error inbox. We were getting ~15
// of these a month on grail.mx/ alone.
//
// This helper memoizes the promise so the first call from a real
// checkout context kicks off the load, repeat calls share it, and the
// `.catch` chains keep the rejection from ever being "unhandled" —
// awaiters still get the rejection re-thrown when they `await` it.

import { loadStripe } from '@stripe/stripe-js'

let _stripePromise = null

export function getStripePromise() {
  if (_stripePromise) return _stripePromise
  const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  if (!key) return null
  _stripePromise = loadStripe(key)
  // Attach a no-op catch so it's never "unhandled" globally. Real awaiters
  // (Elements component, manual checkout code) still see the rejection
  // when they await this promise.
  _stripePromise.catch(() => {})
  return _stripePromise
}
