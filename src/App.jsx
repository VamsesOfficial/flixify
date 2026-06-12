import { useState, useCallback, useEffect } from 'react'
import Navbar        from './components/Navbar'
import TabBar        from './components/TabBar'
import SearchOverlay from './components/SearchOverlay'
import PlayerModal   from './components/PlayerModal'
import AuthModal     from './components/AuthModal'
import PremiumModal  from './components/PremiumModal'
import Toast         from './components/Toast'
import HomePage      from './pages/HomePage'
import WatchlistPage from './pages/WatchlistPage'
import ProfilePage   from './pages/ProfilePage'
import HistoryPage   from './pages/HistoryPage'
import { useWatchlist } from './hooks/useWatchlist'
import { useProgress }  from './hooks/useProgress'
import { useToast }     from './hooks/useToast'
import { useHistory }   from './hooks/useHistory'
import {
  getSession,
  onSessionChange,
  logout,
  canWatch,
  recordWatch,
} from './lib/auth'
import { syncFromCloud } from './lib/storage'
import styles from './App.module.css'

export default function App() {
  const [activeTab,    setActiveTab]    = useState('home')
  const [searchOpen,   setSearchOpen]   = useState(false)
  const [currentMedia, setCurrentMedia] = useState(null)
  const [user,         setUser]         = useState(null)
  const [showAuth,     setShowAuth]     = useState(false)
  const [showPremium,  setShowPremium]  = useState(false)
  const [authReady,    setAuthReady]    = useState(false)

  const { watchlist, toggle: toggleWatchlist, remove: removeWatchlist, isInList, reload: reloadWatchlist } = useWatchlist()
  const { progress, update: updateProgress, reload: reloadProgress } = useProgress()
  const { toast, show: showToast }           = useToast()
  const { history, add: addHistory, remove: removeHistory, clear: clearHistory, reload: reloadHistory } = useHistory()

  // ── Firebase auth state listener ─────────────────────────
  useEffect(() => {
    const unsub = onSessionChange(async (session) => {
      setUser(session)
      setAuthReady(true)
      if (session) {
        // Pull cloud data into localStorage, then refresh hook states
        await syncFromCloud()
        reloadWatchlist?.()
        reloadHistory?.()
        reloadProgress?.()
      }
    })
    return unsub
  }, []) // eslint-disable-line

  // ── Handle Midtrans redirect callback (?payment=success) ─
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const status = params.get('payment')
    const plan   = params.get('plan')
    if (status === 'success' && plan) {
      showToast('Premium aktif! Nikmati nonton tanpa batas ✨')
      setUser(getSession())
      window.history.replaceState({}, '', window.location.pathname)
    } else if (status === 'error') {
      showToast('Pembayaran gagal. Silakan coba lagi.')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [showToast])

  // ── Tab navigation ────────────────────────────────────────
  const handleTabChange = useCallback((tab) => {
    if (tab === 'search') { setSearchOpen(true); return }
    setActiveTab(tab)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // ── Play handler ─────────────────────────────────────────
  const handlePlay = useCallback(async (media) => {
    const { allowed, reason } = canWatch()
    if (reason === 'guest') { setShowAuth(true); return }
    if (!allowed && reason === 'limit') {
      setShowPremium(true)
      showToast('Batas nonton harian tercapai. Upgrade Premium!')
      return
    }
    await recordWatch()
    setUser(getSession())
    const m = { ...media, season: media.season || 1, episode: media.episode || 1 }
    setCurrentMedia(m)
    addHistory(m)
  }, [addHistory, showToast])

  // ── Watchlist ─────────────────────────────────────────────
  const handleToggleWatchlist = useCallback((movie) => {
    const wasIn = isInList(movie.id)
    toggleWatchlist(movie)
    showToast(wasIn ? 'Dihapus dari Watchlist' : 'Ditambahkan ke Watchlist ✓')
  }, [toggleWatchlist, isInList, showToast])

  const handleRemoveWatchlist = useCallback((id) => {
    removeWatchlist(id)
    showToast('Dihapus dari Watchlist')
  }, [removeWatchlist, showToast])

  // ── Logout ────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    await logout()
    setUser(null)
    showToast('Berhasil keluar')
  }, [showToast])

  // ── Peachify postMessage ──────────────────────────────────
  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== 'https://peachify.top') return
      if (event.data?.type === 'MEDIA_DATA')
        updateProgress(event.data.data)
      if (event.data?.type === 'PLAYER_EVENT' && event.data.data?.event === 'ended')
        showToast('Selesai ditonton ✓')
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [updateProgress, showToast])

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (currentMedia) setCurrentMedia(null)
        else if (searchOpen) setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentMedia, searchOpen])

  // ── Loading screen while Firebase resolves auth ───────────
  if (!authReady) return <SplashScreen />

  return (
    <>
      <Navbar
        user={user}
        onSearchOpen={() => setSearchOpen(true)}
        onLoginClick={() => setShowAuth(true)}
        onProfileClick={() => handleTabChange('profile')}
      />

      <main className={styles.main}>
        {activeTab === 'home' && (
          <HomePage
            onPlay={handlePlay}
            watchlist={watchlist}
            onToggleWatchlist={handleToggleWatchlist}
            progress={progress}
          />
        )}
        {activeTab === 'history' && (
          <HistoryPage
            history={history}
            onPlay={handlePlay}
            onRemove={removeHistory}
            onClear={clearHistory}
            onShowToast={showToast}
          />
        )}
        {activeTab === 'watchlist' && (
          <WatchlistPage
            watchlist={watchlist}
            onPlay={handlePlay}
            onRemove={handleRemoveWatchlist}
          />
        )}
        {activeTab === 'profile' && (
          <ProfilePage
            user={user}
            onShowToast={showToast}
            onTabChange={handleTabChange}
            onLoginClick={() => setShowAuth(true)}
            onPremiumClick={() => setShowPremium(true)}
            onLogout={handleLogout}
          />
        )}
      </main>

      <TabBar active={activeTab} onChange={handleTabChange} />

      <SearchOverlay
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handlePlay}
      />

      <PlayerModal
        media={currentMedia}
        onClose={() => setCurrentMedia(null)}
        isInList={isInList}
        onToggleWatchlist={handleToggleWatchlist}
        onShowToast={showToast}
        progress={progress}
      />

      <AuthModal
        visible={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={(u) => { setUser(u); setShowAuth(false) }}
      />

      <PremiumModal
        visible={showPremium}
        onClose={() => setShowPremium(false)}
        onSuccess={() => {
          setUser(getSession())
          setShowPremium(false)
          showToast('Premium aktif! Nikmati nonton tanpa batas ✨')
        }}
      />

      <Toast msg={toast.msg} visible={toast.visible} />
    </>
  )
}

// ── Splash Screen ─────────────────────────────────────────────
function SplashScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#000',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 20,
    }}>
      <div style={{
        fontSize: 32, fontWeight: 800, letterSpacing: -1, color: '#fff',
      }}>
        <span style={{ color: '#e50914' }}>Flix</span>ify
      </div>
      <div style={{
        width: 36, height: 36,
        border: '3px solid rgba(255,255,255,0.15)',
        borderTopColor: '#e50914',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
