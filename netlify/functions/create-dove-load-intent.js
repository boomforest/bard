const Stripe  = require('stripe')
const { createClient } = require('@supabase/supabase-js')
const { applicationFeeFor } = require('./_lib/connect-fees.cjs')

// Creates a Stripe PaymentIntent to load Doves onto a bar balance.
//
// POST body: { event_id, amount_cents, email, customer_name }
// Response:  { clientSecret, total_cents, application_fee_cents }
//
// Same Connect routing pattern as ticket / per-order bar payments —
// funds flow to the promoter's connected account; platform takes its fee
// + Stripe's processing fee passed through (see _lib/connect-fees.js).

const MIN_LOAD_CENTS   = 500       // $5
const MAX_LOAD_CENTS   = 100000    // $1000

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { event_id, amount_cents, email, customer_name } = JSON.parse(event.body || '{}')
    const amount = Math.floor(Number(amount_cents) || 0)
    if (!event_id) throw new Error('event_id required')
    if (!amount || amount < MIN_LOAD_CENTS) throw new Error(`Minimum load is $${MIN_LOAD_CENTS / 100}`)
    if (amount > MAX_LOAD_CENTS) throw new Error(`Maximum load is $${MAX_LOAD_CENTS / 100}`)

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    const { data: ev, error: evErr } = await supabase
      .from('events')
      .select('id, slug, name, promoter_id, currency, bar_enabled')
      .eq('id', event_id)
      .maybeSingle()
    if (evErr || !ev) throw new Error('Event not found')
    if (ev.bar_enabled === false) throw new Error('Bar is disabled for this event')

    const { data: promoter, error: promErr } = await supabase
      .from('users')
      .select('stripe_account_id, stripe_charges_enabled')
      .eq('id', ev.promoter_id)
      .maybeSingle()
    if (promErr) throw promErr
    if (!promoter?.stripe_account_id || !promoter.stripe_charges_enabled) {
      throw new Error('This event is not ready to accept bar payments yet.')
    }

    const applicationFeeCents = applicationFeeFor(amount)
    const currency = (ev.currency || 'mxn').toLowerCase()

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      application_fee_amount: applicationFeeCents,
      transfer_data:          { destination: promoter.stripe_account_id },
      automatic_payment_methods: { enabled: true },
      metadata: {
        kind:           'dove_load',
        event_id:       ev.id,
        event_slug:     ev.slug || '',
        event_name:     ev.name || '',
        amount_cents:   String(amount),
        email:          email || '',
        customer_name:  customer_name || '',
      },
    })

    return {
      statusCode: 200,
      body: JSON.stringify({
        clientSecret:          paymentIntent.client_secret,
        total_cents:           amount,
        application_fee_cents: applicationFeeCents,
      }),
    }
  } catch (err) {
    console.error('create-dove-load-intent error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
