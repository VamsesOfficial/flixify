import { IMG } from '../lib/tmdb'
import styles from './HistoryPage.module.css'

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (mins < 1) return 'Baru saja'
  if (mins < 60) return `${mins} mnt lalu`
  if (hours < 24) return `${hours} jam lalu`
  if (days < 7) return `${days} hari lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function HistoryPage({ history, onPlay, onRemove, onClear, onShowToast }) {
  if (history.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div className={styles.emptyTitle}>Belum ada riwayat</div>
        <div className={styles.emptySub}>Film yang kamu tonton akan muncul di sini</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Riwayat Tontonan</div>
        <button
          className={styles.clearBtn}
          onClick={() => {
            onClear()
            onShowToast('Riwayat dihapus')
          }}
        >
          Hapus Semua
        </button>
      </div>

      <div className={styles.list}>
        {history.map((item) => (
          <div key={`${item.id}-${item.watched_at}`} className={styles.item}>
            <div
              className={styles.poster}
              onClick={() => onPlay({ ...item })}
            >
              {item.poster_path
                ? <img src={`${IMG}/w185${item.poster_path}`} alt={item.title} loading="lazy" />
                : <div className={styles.posterFallback}>{item.title?.[0]}</div>
              }
              <div className={styles.playOverlay}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </div>
            </div>

            <div className={styles.meta} onClick={() => onPlay({ ...item })}>
              <div className={styles.itemTitle}>{item.title}</div>
              <div className={styles.itemSub}>
                {item.media_type === 'tv' && item.season && (
                  <span className={styles.badge}>S{item.season} E{item.episode || 1}</span>
                )}
                {item.media_type === 'movie' && (
                  <span className={styles.badge}>Film</span>
                )}
                {item.vote_average > 0 && (
                  <span className={styles.rating}>★ {item.vote_average?.toFixed(1)}</span>
                )}
              </div>
              <div className={styles.time}>{timeAgo(item.watched_at)}</div>
            </div>

            <button
              className={styles.removeBtn}
              onClick={(e) => { e.stopPropagation(); onRemove(item.id) }}
              aria-label="Hapus dari riwayat"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
