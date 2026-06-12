import { useState, useEffect, useRef } from 'react'
import { login, register } from '../lib/auth'
import styles from './AuthModal.module.css'

// ── Load Cloudflare Turnstile script once ─────────────────
function loadTurnstile() {
  return new Promise((resolve) => {
    if (window.turnstile) { resolve(); return }
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    s.async = true
    s.onload = resolve
    document.head.appendChild(s)
  })
}

export default function AuthModal({ visible, onClose, onSuccess }) {
  const [tab, setTab]               = useState('login')
  const [form, setForm]             = useState({ name: '', email: '', password: '' })
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [sheetVisible, setSheetVisible] = useState(false)
  const [showPass, setShowPass]     = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const turnstileRef = useRef(null)
  const widgetIdRef  = useRef(null)

  const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''

  // ── Sheet animation ────────────────────────────────────
  useEffect(() => {
    if (visible) {
      const id = requestAnimationFrame(() => setSheetVisible(true))
      return () => cancelAnimationFrame(id)
    } else {
      setSheetVisible(false)
    }
  }, [visible])

  // ── Reset form on open/tab change ─────────────────────
  useEffect(() => {
    if (visible) {
      setForm({ name: '', email: '', password: '' })
      setError('')
      setTurnstileToken('')
    }
  }, [visible, tab])

  // ── Mount Turnstile widget ─────────────────────────────
  useEffect(() => {
    if (!visible || !SITE_KEY) return

    let mounted = true
    loadTurnstile().then(() => {
      if (!mounted || !turnstileRef.current || !window.turnstile) return
      // Reset widget dulu kalau sudah ada
      if (widgetIdRef.current != null) {
        try { window.turnstile.reset(widgetIdRef.current) } catch { /* noop */ }
      }
      widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey:  SITE_KEY,
        theme:    'dark',
        size:     'normal',
        callback: (token) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(''),
        'error-callback':   () => setTurnstileToken(''),
      })
    })

    return () => {
      mounted = false
      if (widgetIdRef.current != null && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current) } catch { /* noop */ }
        widgetIdRef.current = null
      }
    }
  }, [visible, SITE_KEY, tab])

  const close = () => { setSheetVisible(false); setTimeout(onClose, 320) }
  const set   = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  // ── Verify Turnstile server-side ──────────────────────
  async function verifyTurnstile(token) {
    if (!SITE_KEY) return true  // dev mode — skip
    try {
      const res = await fetch('/api/verify-turnstile', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token }),
      })
      const data = await res.json()
      return data.success
    } catch {
      return false
    }
  }

  const handleSubmit = async () => {
    setError('')

    // ── Turnstile check ──────────────────────────────────
    if (SITE_KEY && !turnstileToken) {
      setError('Selesaikan verifikasi terlebih dahulu')
      return
    }

    setLoading(true)
    try {
      // Verify token server-side dulu
      if (SITE_KEY) {
        const ok = await verifyTurnstile(turnstileToken)
        if (!ok) {
          setError('Verifikasi gagal. Refresh dan coba lagi.')
          // Reset widget
          if (widgetIdRef.current != null && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current)
          }
          setTurnstileToken('')
          return
        }
      }

      if (tab === 'login') {
        if (!form.email || !form.password) { setError('Email dan password wajib diisi'); return }
        const res = await login(form.email, form.password)
        if (!res.success) { setError(res.error); return }
        onSuccess(res.user)
        close()
      } else {
        if (!form.name || !form.email || !form.password) { setError('Semua field wajib diisi'); return }
        if (form.password.length < 6) { setError('Password minimal 6 karakter'); return }
        const res = await register(form.name, form.email, form.password)
        if (!res.success) { setError(res.error); return }
        onSuccess(res.user)
        close()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => { if (e.key === 'Enter') handleSubmit() }

  if (!visible && !sheetVisible) return null

  return (
    <div
      className={styles.backdrop}
      style={{ background: sheetVisible ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)' }}
      onClick={close}
    >
      <div
        className={styles.sheet}
        style={{ transform: sheetVisible ? 'translateY(0)' : 'translateY(100%)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.handle} />

        <div className={styles.inner}>
          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tabBtn} ${tab === 'login' ? styles.tabActive : ''}`}
              onClick={() => { setTab('login'); setError('') }}
            >Masuk</button>
            <button
              className={`${styles.tabBtn} ${tab === 'register' ? styles.tabActive : ''}`}
              onClick={() => { setTab('register'); setError('') }}
            >Daftar</button>
            <div
              className={styles.tabIndicator}
              style={{ transform: `translateX(${tab === 'login' ? '0%' : '100%'})` }}
            />
          </div>

          <div className={styles.formBody}>
            {tab === 'register' && (
              <div className={styles.field}>
                <label className={styles.label}>Nama</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Nama lengkap"
                  value={form.name}
                  onChange={set('name')}
                  onKeyDown={handleKey}
                  autoComplete="name"
                  disabled={loading}
                />
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input
                className={styles.input}
                type="email"
                placeholder="email@contoh.com"
                value={form.email}
                onChange={set('email')}
                onKeyDown={handleKey}
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Password</label>
              <div className={styles.passWrap}>
                <input
                  className={`${styles.input} ${styles.inputPass}`}
                  type={showPass ? 'text' : 'password'}
                  placeholder={tab === 'register' ? 'Minimal 6 karakter' : 'Password'}
                  value={form.password}
                  onChange={set('password')}
                  onKeyDown={handleKey}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  disabled={loading}
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPass(v => !v)}
                  tabIndex={-1}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Cloudflare Turnstile Widget */}
            {SITE_KEY && (
              <div className={styles.turnstileWrap}>
                <div ref={turnstileRef} />
              </div>
            )}

            {error && <div className={styles.error}>{error}</div>}

            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={loading || (!!SITE_KEY && !turnstileToken)}
            >
              {loading
                ? <span className={styles.spinner} />
                : (tab === 'login' ? 'Masuk' : 'Buat Akun')}
            </button>

            {tab === 'login' && (
              <button className={styles.forgotBtn} disabled>
                Lupa password?
              </button>
            )}

            <p className={styles.switchText}>
              {tab === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
              <button
                className={styles.switchLink}
                onClick={() => { setTab(tab === 'login' ? 'register' : 'login'); setError('') }}
              >
                {tab === 'login' ? 'Daftar gratis' : 'Masuk'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
