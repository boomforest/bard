const Stripe  = require('stripe')
const { createClient } = require('@supabase/supabase-js')

// Creates (or reuses) a Stripe Express account for a promoter and returns
// a hosted onboarding URL. Frontend redirects the user to that URL.
//
// POST body: { user_id, email, origin }
// Response:  { url, account_id }
//
// Required env:
//   STRIPE_SECRET_KEY
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  (server-side only — never ship to client)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { user_id, email, origin } = JSON.parse(event.body)
    if (!user_id) throw new Error('user_id required')

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    // Look up the user — reuse existing account if any
    const { data: userRow } = await supabase
      .from('users')
      .select('stripe_account_id, email')
      .eq('id', user_id)
      .maybeSingle()

    let accountId = userRow?.stripe_account_id

    if (!accountId) {
      const account = await stripe.accounts.create({
        type:  'express',
        email: email || userRow?.email,
        capabilities: {
          card_payments: { requested: true },
          transfers:     { requested: true },
        },
      })
      accountId = account.id

      const { error: upErr } = await supabase
        .from('users')
        .update({ stripe_account_id: accountId })
        .eq('id', user_id)
      if (upErr) throw upErr
    }

    const baseUrl = origin || `https://${event.headers.host}`
    const accountLink = await stripe.accountLinks.create({
      account:     accountId,
      refresh_url: `${baseUrl}/stripe/return?retry=1`,
      return_url:  `${baseUrl}/stripe/return`,
      type:        'account_onboarding',
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ url: accountLink.url, account_id: accountId }),
    }
  } catch (err) {
    console.error('stripe-connect-onboard error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
