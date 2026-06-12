import { useState, useEffect, useRef } from 'react'
import { tmdb, IMG } from '../lib/tmdb'
import MovieCard from '../components/MovieCard'
import WideCard from '../components/WideCard'
import styles from './HomePage.module.css'

const GENRE_MAP = {}

const CAT_PILLS = [
  { id: 'popular', label: 'Populer' },
  { id: 'top_rated', label: 'Top Rated' },
  { id: 'upcoming', label: 'Segera Tayang' },
  { id: 'now_playing', label: 'Tayang Kini' },
]

export default function HomePage({ onPlay, watchlist, onToggleWatchlist, progress }) {
  const [heroMovies, setHeroMovies] = useState([])
  const [heroIdx, setHeroIdx] = useState(0)
  const [trendingMovies, setTrendingMovies] = useState([])
  const [tvShows, setTvShows] = useState([])
  const [actionMovies, setActionMovies] = useState([])
  const [activeCat, setActiveCat] = useState('popular')
  const [loadingTrending, setLoadingTrending] = useState(true)
  const heroTimerRef = useRef(null)

  // Load genres on mount
  useEffect(() => {
    const loadGenres = async () => {
      const [mv, tv] = await Promise.all([tmdb('/genre/movie/list'), tmdb('/genre/tv/list')])
      ;[...mv.genres, ...tv.genres].forEach((g) => { GENRE_MAP[g.id] = g.name })
    }
    loadGenres()
  }, [])

  // Load initial data
  useEffect(() => {
    const init = async () => {
      try {
        const [hero, tv, action] = await Promise.all([
          tmdb('/trending/all/week'),
          tmdb('/tv/popular'),
          tmdb('/discover/movie', { with_genres: '28', sort_by: 'popularity.desc' }),
        ])
        setHeroMovies(hero.results.slice(0, 5))
        setTvShows(tv.results.slice(0, 10))
        setActionMovies(action.results.slice(0, 10))
      } catch (e) { console.error(e) }
    }
    init()
  }, [])

  // Load trending by category
  useEffect(() => {
    const loadTrending = async () => {
      setLoadingTrending(true)
      try {
        const endpoints = {
          popular: '/movie/popular',
          top_rated: '/movie/top_rated',
          upcoming: '/movie/upcoming',
          now_playing: '/movie/now_playing',
        }
        const data = await tmdb(endpoints[activeCat])
        setTrendingMovies(data.results.slice(0, 15))
      } catch { /* noop */ }
      setLoadingTrending(false)
    }
    loadTrending()
  }, [activeCat])

  // Hero auto-rotate
  useEffect(() => {
    if (!heroMovies.length) return
    heroTimerRef.current = setInterval(() => {
      setHeroIdx((prev) => (prev + 1) % heroMovies.length)
    }, 6000)
    return () => clearInterval(heroTimerRef.current)
  }, [heroMovies.length])

  const hero = heroMovies[heroIdx]
  const inList = hero ? watchlist.some((w) => w.id === hero.id) : false

  // Continue watching
  const continueItems = Object.values(progress).filter(
    (p) => p.progress && p.progress.watched > 5 && p.progress.watched < p.progress.duration * 0.95
  )

  return (
    <div>
      {/* ── Hero ── */}
      <div className={styles.hero}>
        {!hero && <div className={`skeleton ${styles.heroSkeleton}`} />}
        {hero && (
          <>
            {hero.backdrop_path && (
              <div
                className={styles.heroBackdrop}
                style={{ backgroundImage: `url(${IMG}/original${hero.backdrop_path})` }}
              />
            )}
            <div className={styles.heroGradient} />
            <div className={styles.heroDots}>
              {heroMovies.map((_, i) => (
                <div
                  key={i}
                  className={`${styles.heroDot} ${i === heroIdx ? styles.heroDotActive : ''}`}
                  onClick={() => { setHeroIdx(i); clearInterval(heroTimerRef.current) }}
                />
              ))}
            </div>
            <div className={styles.heroContent}>
              <div className={styles.heroGenres}>
                {(hero.genre_ids || []).slice(0, 3).map((id) => GENRE_MAP[id]).filter(Boolean).map((g) => (
                  <span key={g} className={styles.heroGenreTag}>{g}</span>
                ))}
              </div>
              <div className={styles.heroTitle}>{hero.title || hero.name}</div>
              <div className={styles.heroMeta}>
                {(hero.release_date || hero.first_air_date || '').slice(0, 4) && (
                  <><span>{(hero.release_date || hero.first_air_date).slice(0, 4)}</span><span className={styles.heroDot2} /></>
                )}
                {hero.vote_average && (
                  <span className={styles.heroRating}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#ffd60a">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    {hero.vote_average.toFixed(1)}
                  </span>
                )}
              </div>
              <div className={styles.heroActions}>
                <button className={styles.btnPlay} onClick={() => onPlay({ ...hero, media_type: hero.media_type || 'movie' })}>
                  <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor"><path d="M1 0l13 8-13 8z"/></svg>
                  Putar
                </button>
                <button
                  className={`${styles.btnList} ${inList ? styles.btnListActive : ''}`}
                  onClick={() => onToggleWatchlist({ ...hero, media_type: hero.media_type || 'movie' })}
                >
                  {inList
                    ? <><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polyline points="20 6 9 17 4 12"/></svg> Tersimpan</>
                    : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Watchlist</>
                  }
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Continue Watching ── */}
      {continueItems.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Lanjutkan Nonton</div>
          </div>
          <div className={styles.scrollRow}>
            {continueItems.slice(0, 8).map((item) => {
              const pct = Math.min(100, Math.round((item.progress.watched / item.progress.duration) * 100))
              const s = item.last_season_watched || 1
              const e = item.last_episode_watched || 1
              return (
                <div
                  key={item.id}
                  className={`${styles.movieCard} fade-up`}
                  onClick={() => onPlay({ id: item.id, media_type: item.type || 'movie', title: item.title, poster_path: item.poster_path, season: s, episode: e })}
                >
                  <div className={styles.poster}>
                    {item.poster_path && <img src={`${IMG}/w300${item.poster_path}`} alt={item.title} loading="lazy" />}
                    <div className={styles.progressRing}><div className={styles.progressFill} style={{ width: `${pct}%` }} /></div>
                    <div className={styles.pctLabel}>{pct}%</div>
                  </div>
                  <div className={styles.movieName}>{item.title || '—'}</div>
                  <div className={styles.movieSub}>{item.type === 'tv' ? `S${s} E${e}` : 'Lanjutkan'}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Trending ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>Trending</div>
        </div>
        <div className={styles.cats}>
          {CAT_PILLS.map((pill) => (
            <div
              key={pill.id}
              className={`${styles.catPill} ${activeCat === pill.id ? styles.catPillActive : ''}`}
              onClick={() => setActiveCat(pill.id)}
            >
              {pill.label}
            </div>
          ))}
        </div>
        <div className={styles.scrollRow}>
          {loadingTrending
            ? Array.from({ length: 5 }).map((_, i) => <div key={i} className={`skeleton ${styles.skeletonPoster}`} />)
            : trendingMovies.map((m) => (
              <MovieCard key={m.id} movie={m} progress={progress} onClick={() => onPlay({ ...m, media_type: 'movie' })} />
            ))
          }
        </div>
      </div>

      {/* ── TV Series ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>Serial TV</div>
        </div>
        <div className={styles.scrollRow}>
          {!tvShows.length
            ? Array.from({ length: 3 }).map((_, i) => <div key={i} className={`skeleton ${styles.skeletonWide}`} />)
            : tvShows.map((s) => (
              <WideCard key={s.id} show={s} onClick={() => onPlay({ ...s, media_type: 'tv' })} />
            ))
          }
        </div>
      </div>

      {/* ── Action ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>Action &amp; Petualangan</div>
        </div>
        <div className={styles.scrollRow}>
          {!actionMovies.length
            ? Array.from({ length: 4 }).map((_, i) => <div key={i} className={`skeleton ${styles.skeletonPoster}`} />)
            : actionMovies.map((m) => (
              <MovieCard key={m.id} movie={m} progress={progress} onClick={() => onPlay({ ...m, media_type: 'movie' })} />
            ))
          }
        </div>
      </div>
    </div>
  )
}
