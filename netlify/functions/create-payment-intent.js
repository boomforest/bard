const Stripe = require('stripe')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { amount, currency = 'mxn', metadata = {} } = JSON.parse(event.body)
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // convert to cents
      currency,
      metadata,
      automatic_payment_methods: { enabled: true },
    })

    return {
      statusCode: 200,
      body: JSON.stringify({ clientSecret: paymentIntent.client_secret }),
    }
  } catch (err) {
    console.error('create-payment-intent error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
