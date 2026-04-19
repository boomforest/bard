const Stripe  = require('stripe')
const { createClient } = require('@supabase/supabase-js')

// Checks the live status of a promoter's Stripe Connect account and
// mirrors the relevant flags onto the users row. Called from the
// /stripe/return page after the user completes hosted onboarding.
//
// POST body: { user_id }
// Response:  { account_id, charges_enabled, details_submitted }

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { user_id } = JSON.parse(event.body)
    if (!user_id) throw new Error('user_id required')

    const stripe = Stripe(process.env.STRIPE_SECRET_KEY)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } },
    )

    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('stripe_account_id')
      .eq('id', user_id)
      .maybeSingle()
    if (userErr) throw userErr

    const accountId = userRow?.stripe_account_id
    if (!accountId) {
      return {
        statusCode: 200,
        body: JSON.stringify({ account_id: null, charges_enabled: false, details_submitted: false }),
      }
    }

    const account = await stripe.accounts.retrieve(accountId)
    const charges_enabled    = !!account.charges_enabled
    const details_submitted  = !!account.details_submitted

    await supabase
      .from('users')
      .update({
        stripe_charges_enabled:   charges_enabled,
        stripe_details_submitted: details_submitted,
      })
      .eq('id', user_id)

    return {
      statusCode: 200,
      body: JSON.stringify({
        account_id: accountId,
        charges_enabled,
        details_submitted,
      }),
    }
  } catch (err) {
    console.error('stripe-connect-status error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
