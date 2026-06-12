export const IMG = 'https://image.tmdb.org/t/p'

export async function tmdb(path, params = {}) {
  const url = new URL('/api/tmdb', window.location.origin)
  url.searchParams.set('path', path)
  url.searchParams.set('language', params.language || 'id-ID')
  Object.entries(params).forEach(([k, v]) => {
    if (k !== 'language') url.searchParams.set(k, v)
  })

  const res = await fetch(url.toString())

  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After') || '60'
    throw new Error(`Terlalu banyak request. Coba lagi dalam ${retryAfter} detik.`)
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `TMDB error ${res.status}`)
  }

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
  return base + '?' + params.join('&')
}
