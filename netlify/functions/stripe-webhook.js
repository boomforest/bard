// Stripe webhook handler. Currently scoped to Connect account events
// — keeps users.stripe_charges_enabled + stripe_details_submitted in
// sync without polling. Without this, a promoter whose account gets
// flagged after onboarding (e.g., Stripe needs more docs) would still
// look "ready" on the dashboard, and buyer purchases would fail at
// PaymentIntent creation.
//
// Setup (one-time, in Stripe Dashboard):
//   1. Connect → Settings → Webhooks (the CONNECT section, not the
//      regular Direct webhooks)
//   2. Add endpoint: https://grail.mx/.netlify/functions/stripe-webhook
//   3. Listen for events:
//        - account.updated
//        - account.application.deauthorized
//   4. Copy the signing secret (whsec_...)
//   5. Set STRIPE_WEBHOOK_SECRET in Netlify env (also locally if running
//      `netlify dev` against test webhooks)

const Stripe = require('stripe')
const { createClient } = require('@supabase/supabase-js')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY)
  const sig    = event.headers['stripe-signature'] || event.headers['Stripe-Signature']
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secret) {
    console.error('stripe-webhook: STRIPE_WEBHOOK_SECRET not set')
    return { statusCode: 500, body: 'Webhook secret not configured' }
  }
  if (!sig) {
    return { statusCode: 400, body: 'Missing Stripe signature' }
  }

  let stripeEvent
  try {
    // event.body is the raw string from Netlify — required for sig
    // verification. Don't pre-parse it.
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, secret)
  } catch (err) {
    console.error('stripe-webhook: bad signature:', err.message)
    return { statusCode: 400, body: `Bad signature: ${err.message}` }
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )

  try {
    switch (stripeEvent.type) {
      case 'account.updated': {
        // data.object is the Account itself for Connect events
        const account = stripeEvent.data.object
        if (account?.id) {
          await supabase
            .from('users')
            .update({
              stripe_charges_enabled:   !!account.charges_enabled,
              stripe_details_submitted: !!account.details_submitted,
            })
            .eq('stripe_account_id', account.id)
        }
        break
      }

      case 'account.application.deauthorized': {
        // Promoter revoked our access via their Stripe dashboard.
        // The account ID is at the top level of the event, not on
        // data.object (which is an Application object here).
        const accountId = stripeEvent.account
        if (accountId) {
          await supabase
            .from('users')
            .update({
              stripe_charges_enabled:   false,
              stripe_details_submitted: false,
              stripe_account_id:        null,
            })
            .eq('stripe_account_id', accountId)
        }
        break
      }

      default:
        // Other event types are ignored. We log just enough to debug
        // if a misconfigured webhook starts sending us unexpected
        // traffic, but don't fail — Stripe retries 500s and we don't
        // want a feedback loop.
        console.log(`stripe-webhook: ignoring ${stripeEvent.type}`)
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) }
  } catch (err) {
    console.error('stripe-webhook handler error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
