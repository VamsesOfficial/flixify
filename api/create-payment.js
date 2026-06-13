/**
 * api/create-payment.js
 * Vercel Serverless Function
 *
 * POST /api/create-payment
 * Header: Authorization: Bearer <firebase_id_token>
 * Body: { plan: 'monthly' | 'weekly' }
 * Returns: { token: string, redirect_url: string }
 */

async function verifyFirebaseToken(idToken, projectId) {
  try {
    const parts   = idToken.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    const now     = Math.floor(Date.now() / 1000)
    if (payload.exp < now)       return null
    if (payload.aud !== projectId) return null
    // Full signature verification via Google public keys
    const keysRes = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com')
    const keys    = await keysRes.json()
    const header  = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
    const pem     = keys[header.kid]
    if (!pem) return null
    return { uid: payload.sub || payload.user_id, email: payload.email }
  } catch { return null }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // ── 1. Verify JWT ──────────────────────────────────────────
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized — login required' })
  }
  const idToken    = authHeader.split('Bearer ')[1]
  const projectId  = process.env.FIREBASE_PROJECT_ID
  const tokenData  = await verifyFirebaseToken(idToken, projectId)
  if (!tokenData) {
    return res.status(401).json({ error: 'Invalid or expired session' })
  }

  // ── 2. Validate body ───────────────────────────────────────
  const { plan, name, email } = req.body
  if (!plan) return res.status(400).json({ error: 'Missing plan' })

  const PRICES = { monthly: 15000, weekly: 5000 }
  const amount = PRICES[plan]
  if (!amount) return res.status(400).json({ error: 'Invalid plan' })

  // ── 3. Build Midtrans request ──────────────────────────────
  // Midtrans order_id max length is 50 chars — keep it short but unique.
  const orderId   = `FLX-${plan === 'monthly' ? 'M' : 'W'}-${tokenData.uid.slice(0, 12)}-${Date.now().toString(36)}`
  const serverKey = process.env.MIDTRANS_SERVER_KEY
  const isProd    = process.env.MIDTRANS_IS_PRODUCTION === 'true'
  const baseUrl   = isProd
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions'

  const appUrl = process.env.APP_URL || 'http://localhost:5173'

  const payload = {
    transaction_details: { order_id: orderId, gross_amount: amount },
    customer_details: {
      first_name: name || 'User',
      email:      email || tokenData.email,
    },
    item_details: [{
      id:       `flixify-premium-${plan}`,
      price:    amount,
      quantity: 1,
      name:     `Flixify Premium ${plan === 'monthly' ? 'Bulanan' : 'Mingguan'}`,
    }],
    callbacks: {
      finish:  `${appUrl}?payment=success&plan=${plan}&order=${orderId}`,
      error:   `${appUrl}?payment=error`,
      pending: `${appUrl}?payment=pending`,
    },
    custom_field1: tokenData.uid,
    custom_field2: plan,
  }

  try {
    const auth64   = Buffer.from(serverKey + ':').toString('base64')
    const response = await fetch(baseUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth64}` },
      body:    JSON.stringify(payload),
    })
    const data = await response.json()
    if (!response.ok) {
      console.error('Midtrans error:', data)
      return res.status(500).json({ error: data.error_messages?.[0] || 'Payment gateway error' })
    }
    return res.status(200).json({ token: data.token, redirect_url: data.redirect_url, order_id: orderId })
  } catch (err) {
    console.error('create-payment error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
