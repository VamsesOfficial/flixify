import { useState, useEffect } from 'react'
import { login, register } from '../lib/auth'
import styles from './AuthModal.module.css'

export default function AuthModal({ visible, onClose, onSuccess }) {
  const [tab, setTab]               = useState('login')
  const [form, setForm]             = useState({ name: '', email: '', password: '' })
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [sheetVisible, setSheetVisible] = useState(false)
  const [showPass, setShowPass]     = useState(false)

  useEffect(() => {
    if (visible) {
      const id = requestAnimationFrame(() => setSheetVisible(true))
      return () => cancelAnimationFrame(id)
    } else {
      setSheetVisible(false)
    }
  }, [visible])

  useEffect(() => {
    if (visible) { setForm({ name: '', email: '', password: '' }); setError('') }
  }, [visible, tab])

  const close = () => { setSheetVisible(false); setTimeout(onClose, 320) }
  const set   = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
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

            {error && <div className={styles.error}>{error}</div>}

            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={loading}
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
