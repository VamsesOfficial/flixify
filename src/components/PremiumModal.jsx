import { useState, useEffect } from 'react'
import { getSession, getIdToken, syncSessionFromFirestore } from '../lib/auth'
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
      // ── Get Firebase ID token ────────────────────────────────
      const idToken = await getIdToken()
      if (!idToken) throw new Error('Sesi tidak valid. Silakan login ulang.')

      // ── Request ke API kita → Tokopay ────────────────────────
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

      // ── Redirect ke halaman pembayaran Tokopay ───────────────
      // Tokopay menyediakan pay_url yang sudah berisi semua metode pembayaran
      if (!data.pay_url) throw new Error('Gagal mendapatkan link pembayaran')

      // Simpan ref_id di sessionStorage agar bisa cek status setelah kembali
      sessionStorage.setItem('pending_payment_ref', data.ref_id)
      sessionStorage.setItem('pending_payment_plan', plan)

      // Buka halaman pembayaran Tokopay di tab baru
      window.open(data.pay_url, '_blank')

      // Tampilkan pesan menunggu & polling status
      setLoading(null)
      close()
      startPolling(data.ref_id, plan)

    } catch (err) {
      console.error('Payment error:', err)
      setError(err.message || 'Terjadi kesalahan. Coba lagi.')
      setLoading(null)
    }
  }

  // ── Polling status setelah user membayar ─────────────────────
  const startPolling = (refId, plan) => {
    let attempts = 0
    const maxAttempts = 20 // poll max 10 menit (30 detik x 20)

    const interval = setInterval(async () => {
      attempts++
      if (attempts > maxAttempts) {
        clearInterval(interval)
        return
      }

      try {
        const idToken = await getIdToken()
        if (!idToken) return

        const res = await fetch(`/api/verify-plan`, {
          headers: { 'Authorization': `Bearer ${idToken}` },
        })
        const data = await res.json()

        if (data.plan === 'premium') {
          clearInterval(interval)
          const updated = await syncSessionFromFirestore()
          onSuccess(updated)
          sessionStorage.removeItem('pending_payment_ref')
          sessionStorage.removeItem('pending_payment_plan')
        }
      } catch { /* silent */ }
    }, 30000) // cek tiap 30 detik
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
            Pembayaran aman via Tokopay · Aktif otomatis setelah bayar
          </p>
        </div>
      </div>
    </div>
  )
}
