import { IMG } from '../lib/tmdb'
import styles from './WatchlistPage.module.css'

export default function WatchlistPage({ watchlist, onPlay, onRemove }) {
  return (
    <div>
      <div className={styles.header}>
        <div className={styles.title}>Watchlist</div>
      </div>

      {!watchlist.length ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div className={styles.emptyTitle}>Watchlist Kosong</div>
          <div className={styles.emptySub}>Tekan + di halaman film untuk menyimpan ke Watchlist</div>
        </div>
      ) : (
        <div className={styles.grid}>
          {watchlist.map((m) => (
            <div key={m.id} className={styles.card} onClick={() => onPlay({ ...m })}>
              <div className={styles.poster}>
                {m.poster_path && <img src={`${IMG}/w300${m.poster_path}`} alt={m.title} loading="lazy" />}
                <button
                  className={styles.remove}
                  onClick={(e) => { e.stopPropagation(); onRemove(m.id) }}
                  aria-label="Hapus"
                >
                  ✕
                </button>
              </div>
              <div className={styles.name}>{m.title || '—'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
