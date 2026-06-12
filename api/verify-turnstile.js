/**
 * api/verify-turnstile.js
 * Vercel Serverless Function — Cloudflare Turnstile Verification
 *
 * POST /api/verify-turnstile
 * Body: { token: string }
 * Returns: { success: boolean }
 *
 * ENV VARS required (Vercel, server-side only):
 *   TURNSTILE_SECRET_KEY — dari Cloudflare Dashboard > Turnstile
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { token } = req.body
  if (!token) return res.status(400).json({ success: false, error: 'Missing token' })

  const secretKey = process.env.TURNSTILE_SECRET_KEY
  if (!secretKey) {
    // Kalau secret key belum diset, skip verification (dev mode)
    console.warn('[turnstile] Secret key not configured — skipping verification')
    return res.status(200).json({ success: true })
  }

  try {
    const formData = new FormData()
    formData.append('secret',   secretKey)
    formData.append('response', token)
    // Sertakan IP untuk keamanan ekstra
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    if (ip) formData.append('remoteip', ip)

    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body:   formData,
    })

    const data = await verifyRes.json()

    if (!data.success) {
      console.warn('[turnstile] Verification failed:', data['error-codes'])
      return res.status(400).json({ success: false, error: 'Verifikasi gagal. Coba lagi.' })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[turnstile] error:', err)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
