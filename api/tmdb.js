/**
 * api/tmdb.js — TMDB Proxy + Rate Limiter
 *
 * Limit: 60 request per IP per menit
 */

const TMDB_BASE = 'https://api.tmdb.org/3'
export const IMG = 'https://image.tmdb.org/t/p'

const ALLOWED_PATHS = [
  '/movie/', '/tv/', '/search/',
  '/trending/', '/genre/', '/person/', '/discover/',
]

// ── In-memory rate limiter ─────────────────────────────────
// Map<ip, { count, resetAt }>
const rateMap = new Map()
const LIMIT        = 150   // max request per window
const WINDOW_MS    = 60 * 1000  // 150 req per menit per IP  // 1 menit

function checkRateLimit(ip) {
  const now  = Date.now()
  const data = rateMap.get(ip)

  if (!data || now > data.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: LIMIT - 1 }
  }

  if (data.count >= LIMIT) {
    return { allowed: false, remaining: 0, resetAt: data.resetAt }
  }

  data.count++
  return { allowed: true, remaining: LIMIT - data.count }
}

// Bersihkan IP lama setiap 5 menit biar memory tidak bocor
setInterval(() => {
  const now = Date.now()
  for (const [ip, data] of rateMap.entries()) {
    if (now > data.resetAt) rateMap.delete(ip)
  }
}, 5 * 60 * 1000)

// ── Handler ────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  // ── Rate limit check ──────────────────────────────────────
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
           || req.headers['x-real-ip']
           || 'unknown'

  const rate = checkRateLimit(ip)
  res.setHeader('X-RateLimit-Limit',     LIMIT)
  res.setHeader('X-RateLimit-Remaining', rate.remaining)

  if (!rate.allowed) {
    const retryAfter = Math.ceil((rate.resetAt - Date.now()) / 1000)
    res.setHeader('Retry-After', retryAfter)
    return res.status(429).json({
      error: `Terlalu banyak request. Coba lagi dalam ${retryAfter} detik.`
    })
  }

  // ── Validate path ─────────────────────────────────────────
  const { path, ...rest } = req.query
  if (!path) return res.status(400).json({ error: 'Missing path' })

  const isAllowed = ALLOWED_PATHS.some((p) => path.startsWith(p))
  if (!isAllowed) return res.status(403).json({ error: 'Path not allowed' })

  // ── Proxy to TMDB ─────────────────────────────────────────
  const TMDB_KEY = process.env.TMDB_KEY
  if (!TMDB_KEY) return res.status(500).json({ error: 'TMDB key not configured' })

  try {
    const url = new URL(TMDB_BASE + path)
    url.searchParams.set('api_key', TMDB_KEY)
    Object.entries(rest).forEach(([k, v]) => {
      if (k !== 'api_key') url.searchParams.set(k, v)
    })

    const upstream = await fetch(url.toString())
    const data     = await upstream.json()

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: data.status_message || 'TMDB error' })
    }

    const isStatic = path.includes('/genre/') || path.includes('/configuration')
    res.setHeader('Cache-Control', isStatic ? 's-maxage=3600' : 's-maxage=300, stale-while-revalidate=60')

    return res.status(200).json(data)
  } catch (err) {
    console.error('[tmdb-proxy] error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
