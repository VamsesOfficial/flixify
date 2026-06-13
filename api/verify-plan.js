/**
 * api/verify-plan.js — Vercel Serverless Function
 *
 * GET /api/verify-plan
 * Header: Authorization: Bearer <firebase_id_token>
 *
 * Baca plan langsung dari Firestore via Admin SDK.
 * Client tidak bisa memalsukan hasilnya.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore }                  from 'firebase-admin/firestore'
import { getAuth }                       from 'firebase-admin/auth'

function getAdmin() {
  if (!getApps().length) {
    // Sama persis dengan cara payment-webhook.js handle private key
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

    initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    })
  }
  return { db: getFirestore(), auth: getAuth() }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Missing token' })

  const idToken = authHeader.split('Bearer ')[1]

  try {
    const { db, auth } = getAdmin()

    const decoded = await auth.verifyIdToken(idToken)
    const uid = decoded.uid

    const snap = await db.collection('users').doc(uid).get()
    if (!snap.exists) return res.status(404).json({ error: 'User not found' })

    const data = snap.data()
    const now  = new Date()

    const isPremium = data.plan === 'premium'
      && data.planExpiry
      && new Date(data.planExpiry) > now

    const today        = now.toDateString()
    const watchedToday = data.lastWatchedDate === today ? (data.watchedToday || 0) : 0
    const freeAllowed  = watchedToday < 1

    return res.status(200).json({
      plan:         isPremium ? 'premium' : 'free',
      allowed:      isPremium || freeAllowed,
      reason:       isPremium ? 'premium' : freeAllowed ? 'free' : 'limit',
      watchedToday,
      planExpiry:   isPremium ? data.planExpiry : null,
    })
  } catch (err) {
    console.error('[verify-plan] error:', err)
    if (err.code === 'auth/id-token-expired')  return res.status(401).json({ error: 'Token expired' })
    if (err.code === 'auth/argument-error' || err.code === 'auth/invalid-id-token')
      return res.status(401).json({ error: 'Invalid token' })
    return res.status(500).json({ error: 'Server error' })
  }
}
