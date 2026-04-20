const Stripe  = require('stripe')
const { createClient } = require('@supabase/supabase-js')

// Verifies a successful PaymentIntent and creates a dove_balances row.
//
// POST body: { payment_intent_id, customer_name, email }
// Response:  { balance: { id, token, loaded_cents, ...} }
//
// Idempotent on stripe_payment_intent_id.

function randomToken() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz'
  let out = ''
  const bytes = require('crypto').randomBytes(20)
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { payment_intent_id, customer_name, email } = JSON.parse(event.body || '{}')
    if (!payment_intent_id) throw new Error('payment_intent_id required')

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    // Idempotency
    const { data: existing } = await supabase
      .from('dove_balances')
      .select('*')
      .eq('stripe_payment_intent_id', payment_intent_id)
      .maybeSingle()
    if (existing) {
      return { statusCode: 200, body: JSON.stringify({ balance: existing, idempotent: true }) }
    }

    const pi = await stripe.paymentIntents.retrieve(payment_intent_id)
    if (!pi) throw new Error('Payment not found')
    if (pi.status !== 'succeeded' && pi.status !== 'processing') {
      throw new Error(`Payment not complete (status: ${pi.status})`)
    }
    if (pi.metadata?.kind !== 'dove_load') {
      throw new Error('PaymentIntent is not a Dove load')
    }

    const event_id = pi.metadata.event_id
    if (!event_id) throw new Error('PaymentIntent missing event_id')

    const token = randomToken()
    const loaded_cents = pi.amount_received || pi.amount

    const { data: row, error: insErr } = await supabase
      .from('dove_balances')
      .insert({
        event_id,
        token,
        email:                    email || pi.metadata.email || null,
        customer_name:            customer_name || pi.metadata.customer_name || null,
        loaded_cents,
        spent_cents:              0,
        status:                   'active',
        stripe_payment_intent_id: payment_intent_id,
      })
      .select('*')
      .single()
    if (insErr) throw insErr

    return { statusCode: 200, body: JSON.stringify({ balance: row }) }
  } catch (err) {
    console.error('finalize-dove-load error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
