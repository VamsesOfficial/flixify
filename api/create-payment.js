/**
 * api/create-payment.js
 * Vercel Serverless Function
 *
 * POST /api/create-payment
 * Body: { plan: 'monthly' | 'weekly', userId: string, email: string, name: string }
 * Returns: { token: string, redirect_url: string }
 *
 * ENV VARS required in Vercel dashboard:
 *   MIDTRANS_SERVER_KEY   — from Midtrans dashboard (starts with SB- for sandbox)
 *   MIDTRANS_IS_PRODUCTION — 'true' | 'false'
 */

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { plan, userId, email, name } = req.body

  if (!plan || !userId || !email) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const PRICES = {
    monthly: 15000,
    weekly:  5000,
  }

  const amount = PRICES[plan]
  if (!amount) return res.status(400).json({ error: 'Invalid plan' })

  const orderId    = `FLIXIFY-${plan.toUpperCase()}-${userId}-${Date.now()}`
  const serverKey  = process.env.MIDTRANS_SERVER_KEY
  const isProd     = process.env.MIDTRANS_IS_PRODUCTION === 'true'
  const baseUrl    = isProd
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions'

  const payload = {
    transaction_details: {
      order_id:     orderId,
      gross_amount: amount,
    },
    customer_details: {
      first_name: name || 'User',
      email:      email,
    },
    item_details: [
      {
        id:       `flixify-premium-${plan}`,
        price:    amount,
        quantity: 1,
        name:     `Flixify Premium ${plan === 'monthly' ? 'Bulanan' : 'Mingguan'}`,
      },
    ],
    callbacks: {
      finish:  `${process.env.VITE_APP_URL || 'http://localhost:5173/'}?payment=success&plan=${plan}&order=${orderId}`,
      error:   `${process.env.VITE_APP_URL || 'http://localhost:5173/'}?payment=error`,
      pending: `${process.env.VITE_APP_URL || 'http://localhost:5173/'}?payment=pending`,
    },
    // pass userId in custom field so webhook can identify user
    custom_field1: userId,
    custom_field2: plan,
  }

  try {
    const auth64 = Buffer.from(serverKey + ':').toString('base64')
    const response = await fetch(baseUrl, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${auth64}`,
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Midtrans error:', data)
      return res.status(500).json({ error: data.error_messages?.[0] || 'Payment gateway error' })
    }

    return res.status(200).json({
      token:        data.token,
      redirect_url: data.redirect_url,
      order_id:     orderId,
    })
  } catch (err) {
    console.error('create-payment error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
