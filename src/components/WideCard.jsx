import { IMG } from '../lib/tmdb'
import styles from './WideCard.module.css'

export default function WideCard({ show, onClick }) {
  const thumb = show.backdrop_path
    ? `${IMG}/w780${show.backdrop_path}`
    : show.poster_path ? `${IMG}/w500${show.poster_path}` : ''
  const title = show.name || show.title || '—'
  const year = (show.first_air_date || show.release_date || '').slice(0, 4)
  const rating = show.vote_average ? show.vote_average.toFixed(1) : ''

  return (
    <div className={`${styles.card} fade-up`} onClick={onClick} title={title}>
      <div className={styles.thumb}>
        {thumb && <img src={thumb} alt={title} loading="lazy" onError={(e) => { e.target.style.display = 'none' }} />}
        <div className={styles.playIcon}>
          <div className={styles.playCircle}>
            <svg width="16" height="18" viewBox="0 0 14 16" fill="#000"><path d="M1 0l13 8-13 8z"/></svg>
          </div>
        </div>
        {rating && (
          <div className={styles.rating}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#ffd60a">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {rating}
          </div>
        )}
      </div>
      <div className={styles.name}>{title}</div>
      {year && <div className={styles.sub}>{year} · Serial TV</div>}
    </div>
  )
}
