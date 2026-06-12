/**
 * api/payment-webhook.js
 * Vercel Serverless Function
 *
 * POST /api/payment-webhook
 * Midtrans sends notification here after payment status changes.
 *
 * ENV VARS required:
 *   MIDTRANS_SERVER_KEY
 *   MIDTRANS_IS_PRODUCTION
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY   (paste the full key from Firebase service account JSON, including \n)
 */

import { createHmac } from 'crypto'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore }                  from 'firebase-admin/firestore'

// Initialise Firebase Admin (safe to call multiple times on warm lambda)
function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    })
  }
  return getFirestore()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const body        = req.body
  const serverKey   = process.env.MIDTRANS_SERVER_KEY
  const orderId     = body.order_id
  const statusCode  = body.status_code
  const grossAmount = body.gross_amount

  // ── Verify Midtrans signature ──────────────────────────────
  const expectedSig = createHmac('sha512', serverKey)
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex')

  if (body.signature_key !== expectedSig) {
    console.warn('Invalid Midtrans signature')
    return res.status(403).json({ error: 'Invalid signature' })
  }

  const transactionStatus = body.transaction_status
  const fraudStatus       = body.fraud_status

  const isSuccess =
    (transactionStatus === 'capture' && fraudStatus === 'accept') ||
    transactionStatus === 'settlement'

  if (!isSuccess) {
    // Not yet paid / pending / failed — just acknowledge
    return res.status(200).json({ status: 'ignored', transactionStatus })
  }

  // ── Activate premium in Firestore ─────────────────────────
  const userId = body.custom_field1
  const plan   = body.custom_field2

  if (!userId || !plan) {
    console.error('Missing custom_field1/2 in webhook body')
    return res.status(400).json({ error: 'Missing user metadata' })
  }

  const expiry = new Date()
  if (plan === 'monthly') expiry.setDate(expiry.getDate() + 30)
  else                    expiry.setDate(expiry.getDate() + 7)

  try {
    const db = getAdminDb()
    await db.collection('users').doc(userId).update({
      plan:        'premium',
      planExpiry:  expiry.toISOString(),
      lastOrderId: orderId,
      updatedAt:   new Date().toISOString(),
    })

    // Record in payments sub-collection for audit trail
    await db.collection('payments').add({
      userId,
      plan,
      orderId,
      amount:          body.gross_amount,
      paymentType:     body.payment_type,
      transactionTime: body.transaction_time,
      status:          transactionStatus,
      planExpiry:      expiry.toISOString(),
      createdAt:       new Date().toISOString(),
    })

    console.log(`Premium activated: user=${userId} plan=${plan} expiry=${expiry.toISOString()}`)
    return res.status(200).json({ status: 'ok' })
  } catch (err) {
    console.error('Firestore update failed:', err)
    return res.status(500).json({ error: 'Database error' })
  }
}
