import { useState, useEffect } from 'react'
import { getSession, activatePremium, getIdToken } from '../lib/auth'
import styles from './PremiumModal.module.css'

const BENEFITS = [
  { icon: '🎬', text: 'Tonton tanpa batas setiap hari' },
  { icon: '⚡', text: 'Prioritas fitur baru' },
  { icon: '🚫', text: 'Bebas batas harian' },
]

const PLANS = [
  { key: 'weekly',  label: 'Mingguan', price: 'Rp 5.000',  per: '/mgg', days: 7  },
  { key: 'monthly', label: 'Bulanan',  price: 'Rp 15.000', per: '/bln', days: 30, popular: true },
]

export default function PremiumModal({ visible, onClose, onSuccess }) {
  const [sheetVisible, setSheetVisible] = useState(false)
  const [loading, setLoading]           = useState(null)  // 'weekly' | 'monthly' | null
  const [error, setError]               = useState('')

  useEffect(() => {
    if (visible) {
      const id = requestAnimationFrame(() => setSheetVisible(true))
      return () => cancelAnimationFrame(id)
    } else {
      setSheetVisible(false)
    }
  }, [visible])

  const close = () => { setSheetVisible(false); setTimeout(onClose, 320) }

  const handleActivate = async (plan) => {
    setError('')
    setLoading(plan)

    const session = getSession()

    try {
      // ── Load Midtrans Snap script once ──────────────────
      await loadSnapScript()

      // ── Get Firebase ID token for auth ──────────────────
      const idToken = await getIdToken()
      if (!idToken) throw new Error('Sesi tidak valid. Silakan login ulang.')

      // ── Request token from our Vercel API ───────────────
      const res = await fetch('/api/create-payment', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          plan,
          name:  session?.name  || 'User',
          email: session?.email || '',
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gagal membuat transaksi')

      // ── Open Midtrans Snap popup ─────────────────────────
      window.snap.pay(data.token, {
        onSuccess: async () => {
          // Webhook will update Firestore; we also update local session
          await activatePremium(plan)
          setLoading(null)
          close()
          setTimeout(() => onSuccess(), 350)
        },
        onPending: () => {
          setLoading(null)
          close()
        },
        onError: (err) => {
          console.error('Snap error:', err)
          setError('Pembayaran gagal. Silakan coba lagi.')
          setLoading(null)
        },
        onClose: () => {
          // User closed Snap without paying
          setLoading(null)
        },
      })
    } catch (err) {
      console.error('Payment error:', err)
      setError(err.message || 'Terjadi kesalahan. Coba lagi.')
      setLoading(null)
    }
  }

  if (!visible && !sheetVisible) return null

  return (
    <div
      className={styles.backdrop}
      style={{ background: sheetVisible ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0)' }}
      onClick={close}
    >
      <div
        className={styles.sheet}
        style={{ transform: sheetVisible ? 'translateY(0)' : 'translateY(100%)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.handle} />

        <div className={styles.inner}>
          <div className={styles.glowBar} />

          {/* Header */}
          <div className={styles.headerRow}>
            <span className={styles.badge}>✨ PREMIUM</span>
            <div className={styles.title}>Flixify Premium</div>
            <div className={styles.subtitle}>Nikmati pengalaman menonton tanpa gangguan</div>
          </div>

          {/* Benefits */}
          <div className={styles.benefitsList}>
            {BENEFITS.map((b) => (
              <div key={b.text} className={styles.benefitItem}>
                <span className={styles.benefitIcon}>{b.icon}</span>
                <span className={styles.benefitText}>{b.text}</span>
              </div>
            ))}
          </div>

          {/* Plans */}
          <div className={styles.plans}>
            {PLANS.map((p) => (
              <button
                key={p.key}
                className={`${styles.planBtn} ${p.popular ? styles.planBtnPopular : ''}`}
                onClick={() => handleActivate(p.key)}
                disabled={!!loading}
              >
                {p.popular && <div className={styles.popularBadge}>TERBAIK</div>}
                <div className={styles.planName}>{p.label}</div>
                <div className={styles.planPrice}>
                  {p.price}<span className={styles.planPer}>{p.per}</span>
                </div>
                {loading === p.key && (
                  <div className={styles.planLoading}>
                    <span className={styles.spinner} />
                  </div>
                )}
              </button>
            ))}
          </div>

          {error && <div className={styles.payError}>{error}</div>}

          <p className={styles.disclaimer}>
            Pembayaran aman via Midtrans · Aktif langsung setelah bayar
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Load Midtrans Snap.js once ─────────────────────────────────
function loadSnapScript() {
  return new Promise((resolve, reject) => {
    if (window.snap) { resolve(); return }

    const isProduction = import.meta.env.VITE_MIDTRANS_IS_PRODUCTION === 'true'
    const clientKey    = import.meta.env.VITE_MIDTRANS_CLIENT_KEY || ''
    const src = isProduction
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js'

    const script = document.createElement('script')
    script.src = src
    script.setAttribute('data-client-key', clientKey)
    script.onload  = resolve
    script.onerror = () => reject(new Error('Gagal memuat payment gateway'))
    document.head.appendChild(script)
  })
}
