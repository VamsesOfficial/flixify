import { IMG } from '../lib/tmdb'
import styles from './MovieCard.module.css'

export default function MovieCard({ movie, progress = {}, onClick }) {
  const prog = progress[String(movie.id)]
  const pct = prog ? Math.min(100, Math.round((prog.progress.watched / prog.progress.duration) * 100)) : 0
  const poster = movie.poster_path ? `${IMG}/w300${movie.poster_path}` : ''
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : ''
  const year = (movie.release_date || movie.first_air_date || '').slice(0, 4)
  const title = movie.title || movie.name || '—'
  const isNew = movie.vote_count && movie.vote_count < 500

  return (
    <div className={`${styles.card} fade-up`} onClick={onClick} title={title}>
      <div className={styles.poster}>
        {poster && <img src={poster} alt={title} loading="lazy" onError={(e) => { e.target.style.display = 'none' }} />}
        {isNew && <div className={styles.badge}>Baru</div>}
        {rating && (
          <div className={styles.rating}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#ffd60a">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {rating}
          </div>
        )}
        {pct > 0 && (
          <div className={styles.progressRing}>
            <div className={styles.progressFill} style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <div className={styles.name}>{title}</div>
      {year && <div className={styles.sub}>{year}{movie.media_type === 'tv' ? ' · Serial' : ''}</div>}
    </div>
  )
}
