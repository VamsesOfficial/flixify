/**
 * api/payment-webhook.js
 * Vercel Serverless Function
 *
 * POST /api/payment-webhook
 * Tokopay mengirim notifikasi ke sini setelah pembayaran berhasil.
 *
 * ENV VARS required:
 *   TOKOPAY_MERCHANT_ID
 *   TOKOPAY_SECRET_KEY
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY
 */

import { createHash }                    from 'crypto'
import { initializeApp, cert, getApps }  from 'firebase-admin/app'
import { getFirestore }                   from 'firebase-admin/firestore'

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

  const body       = req.body
  const merchantId = process.env.TOKOPAY_MERCHANT_ID
  const secretKey  = process.env.TOKOPAY_SECRET_KEY
  const refId      = body.reff_id
  const status     = body.status // 'Success' | 'Completed' | 'Pending' | 'Failed'

  // ── Verifikasi signature Tokopay: md5(merchant_id:secret:ref_id) ──
  const expectedSig = createHash('md5')
    .update(`${merchantId}:${secretKey}:${refId}`)
    .digest('hex')

  if (body.signature !== expectedSig) {
    console.warn('Invalid Tokopay signature')
    return res.status(403).json({ status: false })
  }

  // Hanya proses jika status sukses
  const isSuccess = status === 'Success' || status === 'Completed'
  if (!isSuccess) {
    return res.status(200).json({ status: true }) // acknowledge, tapi tidak proses
  }

  // ── Parsing uid & plan dari ref_id: FLX-M-<uid12>-<ts> ──
  // Format: FLX-M-... = monthly, FLX-W-... = weekly
  const parts   = refId.split('-')  // ['FLX', 'M'/'W', uid12, ts]
  const planKey = parts[1]          // 'M' atau 'W'
  const uid12   = parts[2]          // uid 12 karakter pertama

  if (!planKey || !uid12) {
    console.error('Cannot parse plan/uid from ref_id:', refId)
    return res.status(400).json({ status: false })
  }

  const plan = planKey === 'M' ? 'monthly' : 'weekly'

  // ── Cari user di Firestore berdasarkan uid prefix ──────────
  // uid disimpan sebagai doc ID, jadi kita query dengan prefix
  const db = getAdminDb()

  try {
    // Cari user yang uid-nya dimulai dengan uid12
    const snapshot = await db.collection('users')
      .orderBy('__name__')
      .startAt(uid12)
      .endAt(uid12 + '\uf8ff')
      .limit(1)
      .get()

    if (snapshot.empty) {
      console.error('User not found for uid prefix:', uid12)
      return res.status(404).json({ status: false })
    }

    const userDoc = snapshot.docs[0]
    const userId  = userDoc.id

    // ── Hitung expiry ──────────────────────────────────────────
    const expiry = new Date()
    if (plan === 'monthly') expiry.setDate(expiry.getDate() + 30)
    else                    expiry.setDate(expiry.getDate() + 7)

    // ── Update Firestore ───────────────────────────────────────
    await db.collection('users').doc(userId).update({
      plan:        'premium',
      planExpiry:  expiry.toISOString(),
      lastOrderId: refId,
      updatedAt:   new Date().toISOString(),
    })

    await db.collection('payments').add({
      userId,
      plan,
      orderId:         refId,
      trxId:           body.reference,
      amount:          body.data?.total_dibayar,
      amountReceived:  body.data?.total_diterima,
      paymentChannel:  body.data?.payment_channel,
      transactionTime: body.data?.updated_at,
      status,
      planExpiry:      expiry.toISOString(),
      createdAt:       new Date().toISOString(),
    })

    console.log(`Premium activated: user=${userId} plan=${plan} expiry=${expiry.toISOString()}`)

    // Tokopay wajib dapat response { status: true }
    return res.status(200).json({ status: true })
  } catch (err) {
    console.error('Firestore update failed:', err)
    return res.status(500).json({ status: false })
  }
}
