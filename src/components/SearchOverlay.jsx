import { useState, useRef, useCallback, useEffect } from 'react'
import { tmdb, IMG } from '../lib/tmdb'
import styles from './SearchOverlay.module.css'

export default function SearchOverlay({ visible, onClose, onSelect }) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (visible) setTimeout(() => inputRef.current?.focus(), 100)
    else {
      setResults([])
      if (inputRef.current) inputRef.current.value = ''
    }
  }, [visible])

  const handleInput = useCallback((e) => {
    const q = e.target.value.trim()
    clearTimeout(debounceRef.current)
    if (!q) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await tmdb('/search/multi', { query: q })
        setResults(
          data.results
            .filter((r) => (r.media_type === 'movie' || r.media_type === 'tv') && r.poster_path)
            .slice(0, 12)
        )
      } catch { /* noop */ }
      setLoading(false)
    }, 400)
  }, [])

  return (
    <div className={`${styles.overlay} ${visible ? styles.visible : ''}`} role="dialog" aria-label="Cari Film">
      <div className={styles.bar}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder="Film, serial, aktor..."
          autoComplete="off"
          spellCheck="false"
          onChange={handleInput}
          className={styles.input}
        />
        <button className={styles.close} onClick={onClose}>Batal</button>
      </div>

      <div className={styles.results}>
        {loading && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`skeleton ${styles.skeletonPoster}`} />
        ))}
        {!loading && results.length === 0 && inputRef.current?.value && (
          <div className={styles.empty}>Tidak ditemukan</div>
        )}
        {!loading && results.map((r) => {
          const title = r.title || r.name || ''
          const year = (r.release_date || r.first_air_date || '').slice(0, 4)
          return (
            <div
              key={r.id}
              className={`${styles.card} fade-up`}
              onClick={() => { onSelect(r); onClose() }}
            >
              <div className={styles.poster}>
                <img
                  src={`${IMG}/w300${r.poster_path}`}
                  alt={title}
                  loading="lazy"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
                <div className={styles.badge} style={{ background: r.media_type === 'tv' ? '#0a84ff' : 'var(--accent)' }}>
                  {r.media_type === 'tv' ? 'TV' : 'Film'}
                </div>
              </div>
              <div className={styles.name}>{title}</div>
              <div className={styles.year}>{year}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
