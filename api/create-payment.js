/**
 * api/create-payment.js
 * Vercel Serverless Function
 *
 * POST /api/create-payment
 * Header: Authorization: Bearer <firebase_id_token>
 * Body: { plan: 'monthly' | 'weekly', name: string, email: string }
 * Returns: { pay_url, ref_id, trx_id }
 */

import { createHash } from 'crypto'

async function verifyFirebaseToken(idToken, projectId) {
  try {
    const parts   = idToken.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    const now     = Math.floor(Date.now() / 1000)
    if (payload.exp < now)        return null
    if (payload.aud !== projectId) return null
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
  const idToken   = authHeader.split('Bearer ')[1]
  const projectId = process.env.FIREBASE_PROJECT_ID
  const tokenData = await verifyFirebaseToken(idToken, projectId)
  if (!tokenData) {
    return res.status(401).json({ error: 'Invalid or expired session' })
  }

  // ── 2. Validate body ───────────────────────────────────────
  const { plan, name, email } = req.body
  if (!plan) return res.status(400).json({ error: 'Missing plan' })

  const PRICES = { monthly: 15000, weekly: 5000 }
  const amount  = PRICES[plan]
  if (!amount) return res.status(400).json({ error: 'Invalid plan' })

  // ── 3. Build Tokopay request ───────────────────────────────
  const merchantId = process.env.TOKOPAY_MERCHANT_ID
  const secretKey  = process.env.TOKOPAY_SECRET_KEY
  const appUrl     = process.env.APP_URL || 'http://localhost:5173'

  // ref_id unik: simpan uid + plan di dalamnya agar bisa diparsing di webhook
  const refId = `FLX-${plan === 'monthly' ? 'M' : 'W'}-${tokenData.uid.slice(0, 12)}-${Date.now().toString(36)}`

  // Signature Tokopay: md5(merchant_id:secret:ref_id)
  const signature = createHash('md5')
    .update(`${merchantId}:${secretKey}:${refId}`)
    .digest('hex')

  const payload = {
    merchant_id:    merchantId,
    kode_channel:   'QRIS', // bisa diganti: BRIVA, BNIVAOP, QRISREALTIME, dll
    reff_id:        refId,
    amount,
    customer_name:  name  || 'User',
    customer_email: email || tokenData.email || '',
    customer_phone: '08000000000',
    redirect_url:   `${appUrl}?payment=success&plan=${plan}&order=${refId}`,
    expired_ts:     0,
    signature,
    items: [{
      product_code: `flixify-premium-${plan}`,
      name:         `Flixify Premium ${plan === 'monthly' ? 'Bulanan' : 'Mingguan'}`,
      price:        amount,
      product_url:  appUrl,
      image_url:    `${appUrl}/logo.png`,
    }],
  }

  try {
    const response = await fetch('https://api.tokopay.id/v1/order', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    const data = await response.json()

    if (data.status !== 'Success' && data.status !== 'Pending') {
      console.error('Tokopay error:', data)
      return res.status(500).json({ error: data.message || 'Payment gateway error' })
    }

    return res.status(200).json({
      pay_url: data.data.pay_url,
      trx_id:  data.data.trx_id,
      ref_id:  refId,
    })
  } catch (err) {
    console.error('create-payment error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
