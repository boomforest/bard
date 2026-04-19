const Stripe  = require('stripe')
const { createClient } = require('@supabase/supabase-js')

// Generic bar-tab PaymentIntent creator with Stripe Connect.
//
// POST body:
//   { event_id, items: [{ menu_item_id, qty }], customer_name }
//
// Response:
//   { clientSecret, total_cents, application_fee_cents,
//     promoter_account, line_summary }
//
// Behavior:
//   - Re-prices server-side from bar_menu_items (never trusts client prices)
//   - Routes payment to the promoter's Connect account
//   - Takes 2% (configurable via GRAIL_PLATFORM_FEE_BPS)
//
// Required env: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const PLATFORM_FEE_BPS = Number(process.env.GRAIL_PLATFORM_FEE_BPS || 200)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { event_id, items, customer_name } = JSON.parse(event.body || '{}')
    if (!event_id || !Array.isArray(items) || items.length === 0) {
      throw new Error('event_id and items[] required')
    }

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    // Load event + promoter
    const { data: ev, error: evErr } = await supabase
      .from('events')
      .select('id, slug, name, promoter_id, currency, bar_enabled')
      .eq('id', event_id)
      .maybeSingle()
    if (evErr || !ev) throw new Error('Event not found')
    if (ev.bar_enabled === false) throw new Error('Bar ordering is disabled for this event')

    const { data: promoter, error: promErr } = await supabase
      .from('users')
      .select('stripe_account_id, stripe_charges_enabled')
      .eq('id', ev.promoter_id)
      .maybeSingle()
    if (promErr) throw promErr
    if (!promoter?.stripe_account_id || !promoter.stripe_charges_enabled) {
      throw new Error('This event is not ready to accept bar payments yet.')
    }

    // Look up authoritative prices
    const itemIds = items.map(i => i.menu_item_id)
    const { data: menuRows, error: menuErr } = await supabase
      .from('bar_menu_items')
      .select('id, name, price_cents, active')
      .in('id', itemIds)
      .eq('event_id', event_id)
    if (menuErr) throw menuErr

    let totalCents = 0
    const lineSummary = []
    for (const item of items) {
      const menu = menuRows.find(m => m.id === item.menu_item_id)
      if (!menu) throw new Error(`Unknown menu item: ${item.menu_item_id}`)
      if (!menu.active) throw new Error(`${menu.name} is not available`)
      const qty = Math.max(1, Math.floor(Number(item.qty) || 0))
      totalCents += menu.price_cents * qty
      lineSummary.push(`${qty}x ${menu.name}`)
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
        kind:           'bar',
        event_id:       ev.id,
        event_slug:     ev.slug || '',
        event_name:     ev.name || '',
        customer_name:  customer_name || '',
        items:          JSON.stringify(items),
        summary:        lineSummary.join(', '),
      },
    })

    return {
      statusCode: 200,
      body: JSON.stringify({
        clientSecret:           paymentIntent.client_secret,
        total_cents:            totalCents,
        application_fee_cents:  applicationFeeCents,
        promoter_account:       promoter.stripe_account_id,
        line_summary:           lineSummary,
      }),
    }
  } catch (err) {
    console.error('create-bar-payment-intent error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
