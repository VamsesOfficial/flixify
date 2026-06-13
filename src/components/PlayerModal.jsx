import { useState, useEffect, useMemo, useRef } from 'react'
import { tmdb, peachifyUrl } from '../lib/tmdb'
import styles from './PlayerModal.module.css'

const PLAYERS = [
  { id: 'primary',    label: 'Primary',    note: 'Player utama — konten paling lengkap' },
  { id: 'vsembed',   label: 'VidSrc',     note: 'VidSrc — stabil, minim iklan' },
  { id: 'videasy',   label: 'Videasy',    note: 'Videasy — kualitas HD, subtitle lengkap' },
  { id: 'autoembed', label: 'AutoEmbed',  note: 'AutoEmbed — multi-server, fallback otomatis' },
  { id: 'multiembed',label: 'MultiEmbed', note: 'MultiEmbed — 10+ server, konten lengkap' },
]

const VIDSRC_DOMAIN = 'vidsrc-embed.ru'

// Hanya tampil sekali per sesi
const adWarningShown = { current: false }

function buildPlayerUrl(playerId, id, type, season, episode, progress) {
  if (playerId === 'primary') return peachifyUrl(id, type, season, episode, progress)

  if (playerId === 'vsembed') {
    if (type === 'movie') return `https://${VIDSRC_DOMAIN}/embed/movie/${id}`
    return `https://${VIDSRC_DOMAIN}/embed/tv/${id}/${season}/${episode}`
  }

  if (playerId === 'videasy') {
    if (type === 'movie') return `https://player.videasy.net/movie/${id}?color=FFA500`
    return `https://player.videasy.net/tv/${id}/${season}/${episode}?color=FFA500`
  }

  if (playerId === 'autoembed') {
    if (type === 'movie') return `https://autoembed.cc/embed/movie/${id}`
    return `https://autoembed.cc/embed/tv/${id}-${season}-${episode}`
  }

  if (playerId === 'multiembed') {
    if (type === 'movie') return `https://multiembed.mov/?video_id=${id}&tmdb=1`
    return `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}`
  }

  return peachifyUrl(id, type, season, episode, progress)
}

function AdWarningSheet({ onDismiss }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(id) }, [])

  const dismiss = () => { setVisible(false); setTimeout(onDismiss, 320) }

  const S = {
    backdrop: {
      position: 'fixed', inset: 0, zIndex: 9999,
      background: visible ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
      transition: 'background 0.3s ease',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    },
    sheet: {
      width: '100%', maxWidth: 520,
      background: '#1c1c1e',
      borderRadius: '20px 20px 0 0',
      paddingBottom: 'max(28px, env(safe-area-inset-bottom))',
      transform: visible ? 'translateY(0)' : 'translateY(100%)',
      transition: 'transform 0.38s cubic-bezier(0.32,0.72,0,1)',
    },
    handle: { width: 36, height: 4, borderRadius: 2, background: '#3a3a3c', margin: '12px auto 18px' },
    inner: { padding: '0 18px' },
    badge: {
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'rgba(255,159,10,0.15)', border: '0.5px solid rgba(255,159,10,0.35)',
      borderRadius: 100, padding: '5px 12px', fontSize: 12, fontWeight: 600,
      color: '#ff9f0a', marginBottom: 14,
    },
    title: { fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.2, marginBottom: 10 },
    sub: { fontSize: 14, color: '#8e8e93', lineHeight: 1.65, marginBottom: 18 },
    tips: { background: '#2c2c2e', borderRadius: 14, marginBottom: 18, overflow: 'hidden' },
    tip: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 14px', borderBottom: '0.5px solid #3a3a3c' },
    tipLast: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 14px' },
    iconWrap: (bg, color) => ({
      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: bg, color: color, fontSize: 15,
    }),
    tipTitle: { fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2 },
    tipDesc: { fontSize: 12, color: '#8e8e93', lineHeight: 1.5 },
    cta: {
      width: '100%', padding: 15, borderRadius: 14,
      background: '#ff9f0a', border: 'none', color: '#000',
      fontSize: 16, fontWeight: 700, cursor: 'pointer',
      letterSpacing: '-0.3px', marginBottom: 10,
    },
    skip: {
      width: '100%', padding: 11, borderRadius: 14,
      background: 'transparent', border: 'none',
      color: '#636366', fontSize: 14, cursor: 'pointer',
    },
  }

  const tips = [
    { bg: 'rgba(255,159,10,0.18)', color: '#ff9f0a', icon: '✕', title: 'Tutup tab iklan', desc: 'Tab baru terbuka? Tutup aja, lalu balik ke Flixify — film tetap jalan.' },
    { bg: 'rgba(55,138,221,0.18)', color: '#5eb0f5', icon: '🛡', title: 'Aktifkan popup blocker', desc: 'Chrome: Setelan → Privasi → Izin Situs → Pop-up → Blokir semua.' },
    { bg: 'rgba(99,153,34,0.18)', color: '#7ac231', icon: '▶', title: 'Coba player lain', desc: 'Ada 5 pilihan player — kalau Primary redirect, coba VidSrc, Videasy, AutoEmbed, atau MultiEmbed.' },
  ]

  return (
    <div style={S.backdrop} onClick={dismiss}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <div style={S.handle} />
        <div style={S.inner}>
          <div style={S.badge}>⚠️ Sebelum nonton</div>
          <div style={S.title}>Waspada iklan<br />tab baru 🛡️</div>
          <div style={S.sub}>
            Player film yang dipakai Flixify berasal dari pihak ketiga —
            kadang membuka <strong style={{ color: '#d1d1d6', fontWeight: 500 }}>tab baru otomatis</strong> saat kamu klik video.
            Itu iklan, bukan error atau virus.
          </div>
          <div style={S.tips}>
            {tips.map((t, i) => (
              <div key={i} style={i < tips.length - 1 ? S.tip : S.tipLast}>
                <div style={S.iconWrap(t.bg, t.color)}>{t.icon}</div>
                <div>
                  <div style={S.tipTitle}>{t.title}</div>
                  <div style={S.tipDesc}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <button style={S.cta} onClick={dismiss}>Siap, Nonton Sekarang</button>
          <button style={S.skip} onClick={dismiss}>Jangan tampilkan lagi</button>
        </div>
      </div>
    </div>
  )
}

export default function PlayerModal({ media, onClose, isInList, onToggleWatchlist, onShowToast, progress }) {
  const [details, setDetails] = useState(null)
  const [currentSeason, setCurrentSeason] = useState(1)
  const [currentEpisode, setCurrentEpisode] = useState(1)
  const [episodes, setEpisodes] = useState([])
  const [activePlayer, setActivePlayer] = useState('primary')
  const [iframeKey, setIframeKey] = useState(0)
  const [showAdWarning, setShowAdWarning] = useState(false)

  const frozenProgress = useRef({})

  const open = !!media
  const type = media?.media_type === 'tv' ? 'tv' : 'movie'

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const src = useMemo(() => open ? buildPlayerUrl(activePlayer, media.id, type, currentSeason, currentEpisode, frozenProgress.current) : '', [iframeKey, open, activePlayer, media?.id, type, currentSeason, currentEpisode])

  useEffect(() => {
    if (!media) { setDetails(null); return }
    document.body.style.overflow = 'hidden'
    setCurrentSeason(media.season || 1)
    setCurrentEpisode(media.episode || 1)
    setActivePlayer('primary')
    frozenProgress.current = progress
    if (!adWarningShown.current) {
      adWarningShown.current = true
      setShowAdWarning(true)
    }

    const loadDetails = async () => {
      try {
        const type = media.media_type === 'tv' ? 'tv' : 'movie'
        const d = media.overview ? media : await tmdb(`/${type}/${media.id}`)
        setDetails({ ...d, media_type: type })
      } catch { /* noop */ }
    }
    loadDetails()
    return () => { document.body.style.overflow = '' }
  }, [media])

  useEffect(() => {
    if (!details || details.media_type !== 'tv') return
    loadEpisodes(currentSeason)
  }, [details, currentSeason])

  const loadEpisodes = async (season) => {
    if (!details) return
    try {
      const data = await tmdb(`/tv/${details.id}/season/${season}`)
      setEpisodes(data.episodes || [])
    } catch { /* noop */ }
  }

  if (!media) return null

  const title = details?.title || details?.name || media.title || media.name || '…'
  const year = (details?.release_date || details?.first_air_date || '').slice(0, 4)
  const runtime = details?.runtime
    ? `${details.runtime} mnt`
    : details?.episode_run_time?.[0] ? `~${details.episode_run_time[0]} mnt/ep` : ''
  const inList = isInList(media.id)

  const handleShare = () => {
    if (navigator.share) navigator.share({ title, url: window.location.href })
    else { navigator.clipboard?.writeText(window.location.href); onShowToast('Link disalin ✓') }
  }

  const changeEpisode = (ep) => {
    setCurrentEpisode(ep.episode_number)
    setIframeKey(k => k + 1)
    onShowToast(`Episode ${ep.episode_number}: ${ep.name || ''}`)
  }

  const switchPlayer = (id) => {
    setActivePlayer(id)
    setIframeKey(k => k + 1)
    onShowToast(`Beralih ke ${PLAYERS.find(p => p.id === id)?.label}`)
  }

  const activePlayerNote = PLAYERS.find(p => p.id === activePlayer)?.note || ''

  return (
    <>
      {showAdWarning && <AdWarningSheet onDismiss={() => setShowAdWarning(false)} />}
      <div className={`${styles.modal} ${open ? styles.open : ''}`} role="dialog">
      {/* Topbar */}
      <div className={styles.topbar}>
        <button className={styles.back} onClick={onClose} aria-label="Kembali">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <div className={styles.titleBlock}>
          <div className={styles.modalTitle}>{title}</div>
          <div className={styles.modalSub}>{type === 'tv' ? `S${currentSeason} · E${currentEpisode}` : ''}</div>
        </div>
      </div>

      {/* Scrollable content wrapper */}
      <div className={styles.scrollContainer}>
        {/* Video player */}
        <div className={styles.frameWrap}>
          <iframe
            key={iframeKey}
            src={open ? src : ''}
            allow="autoplay; fullscreen *; picture-in-picture; encrypted-media"
            allowFullScreen={true}
            webkitAllowFullScreen={true}
            mozAllowFullScreen={true}
            referrerPolicy="no-referrer"
            title={title}
            style={{ border: 'none' }}
          />
        </div>

        {/* Player switcher */}
        <div className={styles.playerSwitcher}>
          <div className={styles.playerSwitcherLabel}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Media tidak bisa diputar? Coba player lain
          </div>
          <div className={styles.playerBtns}>
            {PLAYERS.map((p) => (
              <button
                key={p.id}
                className={`${styles.playerBtn} ${activePlayer === p.id ? styles.playerBtnActive : ''}`}
                onClick={() => switchPlayer(p.id)}
              >
                {activePlayer === p.id && <span className={styles.playerDot} />}
                {p.label}
              </button>
            ))}
          </div>
          <div className={styles.playerNote}>{activePlayerNote}</div>
        </div>

        {/* Info section */}
        <div className={styles.info}>
          <div className={styles.infoTitle}>{title}</div>
          <div className={styles.infoMeta}>
            {year && <span>{year}</span>}
            {runtime && <span>{runtime}</span>}
            {details?.vote_average && (
              <span style={{ color: '#ffd60a', fontWeight: 700 }}>★ {details.vote_average.toFixed(1)}</span>
            )}
            {(details?.genres || []).map((g) => (
              <span key={g.id} className={styles.tag}>{g.name}</span>
            ))}
          </div>

          <div className={styles.options}>
            <button
              className={`${styles.optBtn} ${inList ? styles.accent : ''}`}
              onClick={() => { onToggleWatchlist(details || media); onShowToast(inList ? 'Dihapus dari Watchlist' : 'Ditambahkan ke Watchlist ✓') }}
            >
              {inList ? '✓ Tersimpan' : '+ Watchlist'}
            </button>
            <button className={styles.optBtn} onClick={handleShare}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Bagikan
            </button>
          </div>

          {details?.overview && <p className={styles.overview}>{details.overview}</p>}

          {type === 'tv' && details?.number_of_seasons && (
            <div className={styles.episodeSelector}>
              <div className={styles.episodeLabel}>Episode</div>
              <div className={styles.seasonRow}>
                {Array.from({ length: details.number_of_seasons }, (_, i) => i + 1).map((s) => (
                  <div
                    key={s}
                    className={`${styles.seasonPill} ${s === currentSeason ? styles.active : ''}`}
                    onClick={() => setCurrentSeason(s)}
                  >
                    Musim {s}
                  </div>
                ))}
              </div>
              <div className={styles.episodesGrid}>
                {episodes.map((ep) => {
                  const isCurrent = ep.episode_number === currentEpisode
                  const prog = progress[String(media.id)]
                  const epProg = prog?.show_progress?.[`s${currentSeason}e${ep.episode_number}`]
                  const pct = epProg ? Math.round((epProg.progress.watched / epProg.progress.duration) * 100) : 0
                  return (
                    <div
                      key={ep.episode_number}
                      className={`${styles.epBtn} ${isCurrent ? styles.active : ''}`}
                      onClick={() => changeEpisode(ep)}
                    >
                      <span className={styles.epNum}>{ep.episode_number}</span>
                      <span className={styles.epLabel}>{pct > 0 ? `${pct}%` : 'EP'}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  )
}