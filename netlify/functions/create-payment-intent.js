const Stripe  = require('stripe')
const { createClient } = require('@supabase/supabase-js')
const { applicationFeeFor } = require('./_lib/connect-fees.cjs')

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
//     minus the platform fee. Stripe processing fees are passed through to
//     the promoter (see _lib/connect-fees.js for math).
//
// Required env:
//   STRIPE_SECRET_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   GRAIL_PLATFORM_FEE_BPS, STRIPE_FEE_PASSTHROUGH_BPS,
//   STRIPE_FEE_PASSTHROUGH_FIXED_CENTS  (all optional, see helper for defaults)

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
    const { event_id, items, buyer_email, buyer_name, lang, promo_code, source } = body
    if (!event_id || !Array.isArray(items) || items.length === 0) {
      throw new Error('event_id and items[] required')
    }
    const buyerLang = lang === 'en' ? 'en' : 'es'
    const cleanCode = (promo_code || '').trim().toLowerCase()
    // Source: short slug (alphanumeric / dash / underscore / colon), max 64.
    // Colon + 64-char cap accommodates artist affiliate refs in the form
    // `artist:<uuid>` (~43 chars). Plain string refs like `ig` still fit.
    const cleanSource = (source || '').toString().trim().toLowerCase().replace(/[^a-z0-9_\-:]/g, '').slice(0, 64) || null

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

    // Re-price each line at full price first; promo code (if any) is applied
    // after, so we can validate the code against tier scope and quantity.
    const lines = []   // { tier, qty, full_cents_per, discount_per }
    let subtotalCents = 0
    let totalQty = 0
    const lineSummary = []
    for (const item of items) {
      const tier = tiers.find(t => t.id === item.tier_id)
      if (!tier) throw new Error(`Unknown ticket tier: ${item.tier_id}`)
      const qty = Math.max(1, Math.floor(Number(item.qty) || 0))
      const remaining = tier.qty - (tier.sold || 0)
      if (qty > remaining) throw new Error(`${tier.name}: only ${remaining} left`)
      lines.push({ tier, qty, full_cents_per: tier.price_cents, discount_per: 0 })
      subtotalCents += tier.price_cents * qty
      totalQty += qty
      lineSummary.push(`${qty}x ${tier.name}`)
    }
    if (subtotalCents <= 0) throw new Error('Cart total is zero')

    // ── Promo code validation + per-line discount calc ─────────────────────
    // Server-side only — never trust the client's price math.
    let appliedPromo = null
    let totalDiscountCents = 0
    if (cleanCode) {
      const { data: pc, error: pcErr } = await supabase
        .from('promo_codes')
        .select('id, code, kind, amount_cents, max_uses, used_count, expires_at, tier_id, active')
        .eq('event_id', event_id)
        .ilike('code', cleanCode)
        .maybeSingle()
      if (pcErr) throw pcErr
      if (!pc) throw new Error(`Promo code "${cleanCode}" not valid`)
      if (!pc.active) throw new Error('That promo code has been disabled')
      if (pc.expires_at && new Date(pc.expires_at) < new Date()) {
        throw new Error('That promo code has expired')
      }
      if (pc.max_uses != null && pc.used_count + totalQty > pc.max_uses) {
        const left = Math.max(0, pc.max_uses - pc.used_count)
        throw new Error(left === 0
          ? 'That promo code is fully redeemed'
          : `That promo code only has ${left} use${left === 1 ? '' : 's'} left`)
      }

      // Apply per-line discount, scoped to a tier if one is set on the code.
      for (const ln of lines) {
        if (pc.tier_id && pc.tier_id !== ln.tier.id) continue
        let perTicketDiscount = 0
        if (pc.kind === 'percent') {
          // amount_cents = basis points (1000 = 10%)
          perTicketDiscount = Math.floor(ln.full_cents_per * pc.amount_cents / 10000)
        } else if (pc.kind === 'fixed') {
          perTicketDiscount = Math.min(ln.full_cents_per, pc.amount_cents)
        } else if (pc.kind === 'override') {
          // Override sets the *price* to amount_cents, so discount = full - override
          perTicketDiscount = Math.max(0, ln.full_cents_per - pc.amount_cents)
        }
        ln.discount_per = perTicketDiscount
        totalDiscountCents += perTicketDiscount * ln.qty
      }
      if (totalDiscountCents === 0) {
        throw new Error('That promo code does not apply to anything in your cart')
      }
      appliedPromo = { code: pc.code, kind: pc.kind, amount_cents: pc.amount_cents, id: pc.id }
    }

    const totalCents = Math.max(0, subtotalCents - totalDiscountCents)
    if (totalCents <= 0) {
      // Free total → guest-list flow, not Stripe (Stripe rejects $0 PIs).
      throw new Error('That promo code makes the order free — use the guest list instead')
    }

    // Per-tier discount/qty/applied-promo summary for finalize step. Tight
    // string so we don't blow Stripe's 500-char metadata limit.
    const itemsMeta = lines.map(ln => ({
      tier_id:        ln.tier.id,
      qty:            ln.qty,
      discount_each:  ln.discount_per,
    }))

    const applicationFeeCents = applicationFeeFor(totalCents)
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
        buyer_lang:  buyerLang,
        items:       JSON.stringify(itemsMeta),
        summary:     lineSummary.join(', '),
        ...(appliedPromo ? { promo_code: appliedPromo.code, promo_id: appliedPromo.id, discount_total_cents: String(totalDiscountCents) } : {}),
        ...(cleanSource ? { source: cleanSource } : {}),
      },
    })

    return {
      statusCode: 200,
      body: JSON.stringify({
        clientSecret:           paymentIntent.client_secret,
        subtotal_cents:         subtotalCents,
        discount_cents:         totalDiscountCents,
        total_cents:            totalCents,
        currency,
        application_fee_cents:  applicationFeeCents,
        promoter_account:       promoter.stripe_account_id,
        event_slug:             ev.slug,
        promo_applied:          appliedPromo ? { code: appliedPromo.code } : null,
      }),
    }
  } catch (err) {
    console.error('create-payment-intent error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
