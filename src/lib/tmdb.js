// API key is read from environment variable — never hardcoded
const TMDB_KEY = import.meta.env.VITE_TMDB_KEY
const TMDB_BASE = 'https://api.tmdb.org/3'
export const IMG = 'https://image.tmdb.org/t/p'

if (!TMDB_KEY) {
  console.warn('[Flixify] VITE_TMDB_KEY is not set. Copy .env.example to .env.local and add your key.')
}

export async function tmdb(path, params = {}) {
  const url = new URL(TMDB_BASE + path)
  url.searchParams.set('api_key', TMDB_KEY)
  url.searchParams.set('language', 'id-ID')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url)
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${path}`)
  return res.json()
}

export function peachifyUrl(id, type, season, episode, watchProgress = {}) {
  let base
  if (type === 'movie') base = `https://peachify.top/embed/movie/${id}`
  else base = `https://peachify.top/embed/tv/${id}/${season}/${episode}`

  const params = []
  const prog = watchProgress[String(id)]
  if (prog?.progress?.watched > 10) {
    const watched =
      prog.type === 'tv'
        ? prog.show_progress?.[`s${season}e${episode}`]?.progress?.watched
        : prog.progress.watched
    if (watched && watched > 10) params.push(`startAt=${Math.floor(watched)}`)
  }
  params.push('autoPlay=true')
  // autoNext=true dihapus — menyebabkan loop: episode selesai di iframe tapi
  // state React (currentEpisode) tidak update, lalu progress event masuk dan
  // player kelihatan reload/loading terus setiap beberapa detik
  return base + '?' + params.join('&')
}