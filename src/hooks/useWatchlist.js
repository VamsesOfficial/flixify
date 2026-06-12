import { useState, useCallback } from 'react'
import { loadWatchlist, saveWatchlist } from '../lib/storage'

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState(() => loadWatchlist())

  const reload = useCallback(() => {
    setWatchlist(loadWatchlist())
  }, [])

  const toggle = useCallback((movie) => {
    setWatchlist((prev) => {
      const exists = prev.some((w) => w.id === movie.id)
      const next = exists
        ? prev.filter((w) => w.id !== movie.id)
        : [
            ...prev,
            {
              id:           movie.id,
              title:        movie.title || movie.name,
              poster_path:  movie.poster_path,
              backdrop_path:movie.backdrop_path,
              media_type:   movie.media_type || 'movie',
              vote_average: movie.vote_average,
              added_at:     new Date().toISOString(),
            },
          ]
      saveWatchlist(next)
      return next
    })
  }, [])

  const remove = useCallback((id) => {
    setWatchlist((prev) => {
      const next = prev.filter((w) => w.id !== id)
      saveWatchlist(next)
      return next
    })
  }, [])

  const isInList = useCallback((id) => watchlist.some((w) => w.id === id), [watchlist])

  return { watchlist, toggle, remove, isInList, reload }
}
