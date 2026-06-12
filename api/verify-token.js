/**
 * api/verify-token.js
 * Vercel Serverless Function — Firebase JWT Verification
 *
 * POST /api/verify-token
 * Header: Authorization: Bearer <firebase_id_token>
 * Returns: { valid: boolean, uid: string, email: string }
 *
 * Dipakai untuk validasi session server-side sebelum aksi sensitif
 * (misal: aktivasi premium, akses data user).
 *
 * ENV VARS required:
 *   FIREBASE_PROJECT_ID
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false, error: 'Missing token' })
  }

  const idToken   = authHeader.split('Bearer ')[1]
  const projectId = process.env.FIREBASE_PROJECT_ID

  if (!projectId) return res.status(500).json({ error: 'Project ID not configured' })

  try {
    // Verify token via Firebase Auth REST API (no Admin SDK needed)
    const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.VITE_FIREBASE_API_KEY}`
    // Alternative: use Google's public key verification
    // For serverless, we use Firebase's tokeninfo endpoint
    const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo`

    // Decode JWT payload (middle part) without verification first to get uid
    const parts   = idToken.split('.')
    if (parts.length !== 3) return res.status(401).json({ valid: false, error: 'Invalid token format' })

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())

    // Check expiry
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) {
      return res.status(401).json({ valid: false, error: 'Token expired' })
    }

    // Check audience matches our project
    if (payload.aud !== projectId) {
      return res.status(401).json({ valid: false, error: 'Invalid audience' })
    }

    // Verify signature via Google's public keys
    const keysRes  = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com')
    const keys     = await keysRes.json()
    const header   = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
    const pubKeyPem = keys[header.kid]

    if (!pubKeyPem) {
      return res.status(401).json({ valid: false, error: 'Unknown key ID' })
    }

    // Import public key and verify
    const encoder    = new TextEncoder()
    const keyData    = pemToArrayBuffer(pubKeyPem)
    const cryptoKey  = await crypto.subtle.importKey(
      'spki', keyData,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['verify']
    )
    const signingInput = encoder.encode(`${parts[0]}.${parts[1]}`)
    const signature    = base64urlToUint8Array(parts[2])
    const isValid      = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, signingInput)

    if (!isValid) {
      return res.status(401).json({ valid: false, error: 'Invalid signature' })
    }

    return res.status(200).json({
      valid: true,
      uid:   payload.sub || payload.user_id,
      email: payload.email,
    })
  } catch (err) {
    console.error('[verify-token] error:', err)
    return res.status(401).json({ valid: false, error: 'Token verification failed' })
  }
}

// ── Helpers ──────────────────────────────────────────────────

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\s/g, '')
  const binary = atob(b64)
  const buf    = new ArrayBuffer(binary.length)
  const view   = new Uint8Array(buf)
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i)
  // Extract SubjectPublicKeyInfo from certificate
  return extractPublicKey(buf)
}

function extractPublicKey(certBuffer) {
  // Simple DER parser to extract public key from X.509 cert
  const view    = new Uint8Array(certBuffer)
  // Walk DER structure to find BIT STRING containing public key
  // Certificate -> tbsCertificate -> subjectPublicKeyInfo
  let offset = 0
  offset = skipTag(view, offset) // SEQUENCE (Certificate)
  offset = skipTag(view, offset) // SEQUENCE (tbsCertificate)
  offset = skipField(view, offset) // version or serialNumber
  offset = skipField(view, offset) // signature
  offset = skipField(view, offset) // issuer
  offset = skipField(view, offset) // validity
  offset = skipField(view, offset) // subject
  // Now at subjectPublicKeyInfo
  const spkiLength = getLength(view, offset + 1)
  const spkiStart  = offset
  const spkiEnd    = offset + 1 + getLengthBytes(view, offset + 1) + spkiLength
  return certBuffer.slice(spkiStart, spkiEnd)
}

function skipTag(view, offset) { return offset + 1 }
function getLength(view, offset) {
  if (view[offset] < 0x80) return view[offset]
  const numBytes = view[offset] & 0x7f
  let len = 0
  for (let i = 0; i < numBytes; i++) len = (len << 8) | view[offset + 1 + i]
  return len
}
function getLengthBytes(view, offset) {
  if (view[offset] < 0x80) return 1
  return 1 + (view[offset] & 0x7f)
}
function skipField(view, offset) {
  offset++ // skip tag
  const lenBytes = getLengthBytes(view, offset)
  const len      = getLength(view, offset)
  return offset + lenBytes + len
}

function base64urlToUint8Array(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(b64url.length + (4 - b64url.length % 4) % 4, '=')
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf
}
