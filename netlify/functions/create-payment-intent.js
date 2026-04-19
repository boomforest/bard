const Stripe  = require('stripe')
const { createClient } = require('@supabase/supabase-js')

// Generic ticket-purchase PaymentIntent creator with Stripe Connect.
//
// POST body: { event_id, items: [{ tier_id, qty }], buyer_email, buyer_name }
// Response:  { clientSecret, total_cents, currency, application_fee_cents,
//              promoter_account, event_slug }
//
// Behavior:
//   - Looks up the event + its promoter from Supabase
//   - Re-prices everything server-side from ticket_tiers (never trusts client)
//   - Charges the buyer; routes funds to the promoter's connected account
//     minus a 2% Grail platform fee via application_fee_amount
//
// Required env:
//   STRIPE_SECRET_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   GRAIL_PLATFORM_FEE_BPS  (optional, defaults to 200 = 2.00%)

const PLATFORM_FEE_BPS = Number(process.env.GRAIL_PLATFORM_FEE_BPS || 200)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const body = JSON.parse(event.body || '{}')

    // ── Legacy Nonlinear path: bare { amount, currency } still supported ──
    // Returns a PaymentIntent that does NOT use Connect (hits platform balance).
    if (body.amount && !body.event_id) {
      const stripe = Stripe(process.env.STRIPE_SECRET_KEY)
      const pi = await stripe.paymentIntents.create({
        amount:   Math.round(body.amount * 100),
        currency: body.currency || 'mxn',
        metadata: body.metadata || {},
        automatic_payment_methods: { enabled: true },
      })
      return {
        statusCode: 200,
        body: JSON.stringify({ clientSecret: pi.client_secret }),
      }
    }

    // ── Multi-event Connect path ───────────────────────────────────────────
    const { event_id, items, buyer_email, buyer_name } = body
    if (!event_id || !Array.isArray(items) || items.length === 0) {
      throw new Error('event_id and items[] required')
    }

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    // Load event + tiers + promoter's connected account
    const { data: ev, error: evErr } = await supabase
      .from('events')
      .select('id, slug, name, promoter_id, currency')
      .eq('id', event_id)
      .maybeSingle()
    if (evErr || !ev) throw new Error('Event not found')

    const { data: promoter, error: promErr } = await supabase
      .from('users')
      .select('stripe_account_id, stripe_charges_enabled')
      .eq('id', ev.promoter_id)
      .maybeSingle()
    if (promErr) throw promErr
    if (!promoter?.stripe_account_id || !promoter.stripe_charges_enabled) {
      throw new Error('This event is not ready to accept payments yet.')
    }

    const tierIds = items.map(i => i.tier_id)
    const { data: tiers, error: tierErr } = await supabase
      .from('ticket_tiers')
      .select('id, price_cents, qty, sold, name')
      .in('id', tierIds)
      .eq('event_id', event_id)
    if (tierErr) throw tierErr

    let totalCents = 0
    const lineSummary = []
    for (const item of items) {
      const tier = tiers.find(t => t.id === item.tier_id)
      if (!tier) throw new Error(`Unknown ticket tier: ${item.tier_id}`)
      const qty = Math.max(1, Math.floor(Number(item.qty) || 0))
      const remaining = tier.qty - (tier.sold || 0)
      if (qty > remaining) throw new Error(`${tier.name}: only ${remaining} left`)
      totalCents += tier.price_cents * qty
      lineSummary.push(`${qty}x ${tier.name}`)
    }
    if (totalCents <= 0) throw new Error('Cart total is zero')

    const applicationFeeCents = Math.round((totalCents * PLATFORM_FEE_BPS) / 10000)
    const currency = (ev.currency || 'mxn').toLowerCase()

    const paymentIntent = await stripe.paymentIntents.create({
      amount:                  totalCents,
      currency,
      application_fee_amount:  applicationFeeCents,
      transfer_data: { destination: promoter.stripe_account_id },
      automatic_payment_methods: { enabled: true },
      metadata: {
        event_id:    ev.id,
        event_slug:  ev.slug || '',
        event_name:  ev.name || '',
        buyer_email: buyer_email || '',
        buyer_name:  buyer_name || '',
        items:       JSON.stringify(items),
        summary:     lineSummary.join(', '),
      },
    })

    return {
      statusCode: 200,
      body: JSON.stringify({
        clientSecret:           paymentIntent.client_secret,
        total_cents:            totalCents,
        currency,
        application_fee_cents:  applicationFeeCents,
        promoter_account:       promoter.stripe_account_id,
        event_slug:             ev.slug,
      }),
    }
  } catch (err) {
    console.error('create-payment-intent error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
