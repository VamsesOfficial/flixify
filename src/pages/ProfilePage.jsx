import { useRef } from 'react'
import styles from './ProfilePage.module.css'

const TECH_STACK = ['React', 'Vite', 'TMDB API', 'CSS Modules']

const SUPPORT_LINKS = [
  { name: 'Saweria', emoji: '🐣', url: 'https://saweria.co/vamsesofficial', color: '#f9c22e' },
]

function formatExpiry(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

function getInitials(name = '') {
  return name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U'
}

export default function ProfilePage({ user, onShowToast, onTabChange, onLoginClick, onPremiumClick, onLogout }) {
  const aboutRef = useRef(null)
  const scrollToAbout = () => aboutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const isPremium = user?.plan === 'premium' && user?.planExpiry && new Date(user.planExpiry) > new Date()

  const menuItems = [
    {
      icon: '❤️',
      label: 'Watchlist Saya',
      desc: 'Lihat semua film yang telah disimpan',
      action: () => onTabChange?.('watchlist'),
    },
    {
      icon: '🎬',
      label: 'Riwayat Tontonan',
      desc: 'Lihat film yang pernah dibuka',
      action: () => onTabChange?.('history'),
    },
    {
      icon: '⚙️',
      label: 'Pengaturan',
      desc: 'Kelola preferensi aplikasi',
      action: () => onShowToast?.('Halaman pengaturan segera hadir'),
    },
    {
      icon: 'ℹ️',
      label: 'Tentang Flixify',
      desc: 'Pelajari lebih lanjut tentang aplikasi',
      action: scrollToAbout,
    },
  ]

  if (user) {
    menuItems.push({
      icon: '🚪',
      label: 'Keluar',
      desc: 'Logout dari akun Flixify',
      action: onLogout,
      danger: true,
    })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>Profil</div>
      </div>

      <div className={styles.body}>

        {/* ── 1. User Profile Card ── */}
        <div className={styles.profileCard}>
          {!user ? (
            /* Guest state */
            <div className={styles.guestSection}>
              <div className={styles.guestIcon}>👤</div>
              <div className={styles.guestTitle}>Belum masuk</div>
              <div className={styles.guestDesc}>Masuk untuk menyimpan progress dan riwayat tontonanmu</div>
              <button className={styles.guestLoginBtn} onClick={onLoginClick}>
                Masuk / Daftar
              </button>
            </div>
          ) : (
            /* Logged in state */
            <>
              <div className={styles.profileTop}>
                <div className={styles.avatarRing}>
                  <div className={styles.avatar}>{getInitials(user.name)}</div>
                </div>
                <div className={styles.profileInfo}>
                  <div className={styles.profileName}>{user.name}</div>
                  <div className={styles.profileEmail}>{user.email}</div>
                  <div className={styles.profileMeta}>
                    {isPremium ? (
                      <span className={styles.badgePremium}>✨ Premium</span>
                    ) : (
                      <span className={styles.badge}>🎬 Free Plan</span>
                    )}
                    <span className={styles.joinDate}>
                      {isPremium ? `Aktif hingga ${formatExpiry(user.planExpiry)}` : '1 film/hari gratis'}
                    </span>
                  </div>
                </div>
              </div>
              <div className={styles.statsDivider} />
              <div className={styles.statsRow}>
                <div className={styles.statItem}>
                  <div className={styles.statValue}>{isPremium ? '∞' : '1'}</div>
                  <div className={styles.statLabel}>Film/hari</div>
                </div>
                <div className={styles.statSep} />
                <div className={styles.statItem}>
                  <div className={styles.statValue}>{isPremium ? '✨' : '🎬'}</div>
                  <div className={styles.statLabel}>Plan</div>
                </div>
                <div className={styles.statSep} />
                <div className={styles.statItem}>
                  <div className={styles.statValue}>{isPremium ? 'Pro' : 'Free'}</div>
                  <div className={styles.statLabel}>Status</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── 2. Menu ── */}
        <div className={styles.sectionLabel}>MENU</div>
        <div className={styles.menuCard}>
          {menuItems.map((item, i) => (
            <div
              key={item.label}
              className={`${styles.menuItem} ${item.danger ? styles.menuItemDanger : ''}`}
              onClick={item.action}
              style={i < menuItems.length - 1 ? {} : { borderBottom: 'none' }}
            >
              <div className={styles.menuIconWrap}>{item.icon}</div>
              <div className={styles.menuText}>
                <div className={styles.menuLabel}>{item.label}</div>
                <div className={styles.menuDesc}>{item.desc}</div>
              </div>
              <div className={styles.menuChevron}>›</div>
            </div>
          ))}
        </div>

        {/* ── 3. Premium Card ── */}
        <div className={styles.sectionLabel}>PREMIUM</div>
        {isPremium ? (
          <div className={styles.premiumActiveCard}>
            <div className={styles.premiumActiveGlow} />
            <div className={styles.premiumActiveContent}>
              <div className={styles.premiumActiveTitle}>✨ Premium Aktif</div>
              <div className={styles.premiumActiveExpiry}>
                Aktif hingga {formatExpiry(user.planExpiry)}
              </div>
              <div className={styles.premiumActiveBenefits}>
                <span>✓ Tonton tanpa batas</span>
                <span>✓ Prioritas fitur baru</span>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.premiumCard}>
            <div className={styles.premiumGlow} />
            <div className={styles.premiumContent}>
              <div className={styles.premiumTitle}>✨ Flixify Premium</div>
              <div className={styles.premiumBenefits}>
                <div className={styles.premiumItem}>
                  <span className={styles.premiumCheck}>✓</span> Tonton tanpa batas
                </div>
                <div className={styles.premiumItem}>
                  <span className={styles.premiumCheck}>✓</span> Prioritas fitur baru
                </div>
                <div className={styles.premiumItem}>
                  <span className={styles.premiumCheck}>✓</span> Tanpa sponsor
                </div>
              </div>
              <button
                className={styles.premiumBtn}
                onClick={user ? onPremiumClick : onLoginClick}
              >
                Upgrade Sekarang
              </button>
            </div>
          </div>
        )}

        {/* ── 4. Support Developer ── */}
        <div className={styles.sectionLabel}>DUKUNG KAMI</div>
        <div className={styles.supportCard}>
          <div className={styles.supportTitle}>☕ Dukung Pengembangan Flixify</div>
          <div className={styles.supportDesc}>
            Flixify dikembangkan secara independen. Dukungan Anda membantu
            pengembangan fitur baru, perbaikan bug, dan biaya operasional.
          </div>
          <div className={styles.supportBtns}>
            {SUPPORT_LINKS.map((link) => (
              <button
                key={link.name}
                className={styles.supportBtn}
                style={{ '--support-color': link.color }}
                onClick={() => window.open(link.url, '_blank')}
              >
                <span>{link.emoji}</span> {link.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── 5. Tentang Flixify ── */}
        <div className={styles.sectionLabel} ref={aboutRef}>TENTANG FLIXIFY</div>
        <div className={styles.aboutCard}>
          <div className={styles.aboutAppName}>
            <span className={styles.aboutFlixRed}>Flix</span>ify
          </div>
          <p className={styles.aboutText}>
            Flixify adalah aplikasi pencarian dan eksplorasi film modern yang membantu
            pengguna menemukan film terbaik berdasarkan genre, rating, dan preferensi pribadi.
          </p>
          <p className={styles.aboutText}>
            Aplikasi ini dibangun untuk memberikan pengalaman menjelajah film yang{' '}
            <span className={styles.aboutHighlight}>cepat, ringan, dan menyenangkan</span>.
          </p>

          <div className={styles.aboutDivider} />

          <div className={styles.creatorSection}>
            <div className={styles.creatorLabel}>PEMBUAT</div>
            <div className={styles.creatorRow}>
              <div className={styles.creatorAvatar}>
                <img 
                    src="/developer.png" 
                    alt="Creator Avatar"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              <div className={styles.creatorDetails}>
                <div className={styles.creatorName}>Dev Flixify</div>
                <div className={styles.creatorRole}>Frontend Developer</div>
              </div>
            </div>
            <p className={styles.creatorBio}>
              Pengembang yang memiliki minat pada web development, UI/UX modern,
              dan teknologi JavaScript.
            </p>
            <div className={styles.stackRow}>
              <span className={styles.stackLabel}>Tech Stack</span>
              <div className={styles.stackTags}>
                {TECH_STACK.map((t) => (
                  <span key={t} className={styles.stackTag}>{t}</span>
                ))}
              </div>
            </div>
            <div className={styles.socialRow}>
              <a
                href="https://instagram.com/ketutaguss_"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.socialBtn}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <circle cx="12" cy="12" r="4"/>
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
                </svg>
                @ketutaguss_
              </a>
            </div>
            <div className={styles.visionBox}>
              <div className={styles.visionIcon}>🎯</div>
              <div className={styles.visionText}>
                <div className={styles.visionTitle}>Visi</div>
                <div className={styles.visionDesc}>
                  Membuat platform eksplorasi film yang ringan, modern, dan nyaman
                  digunakan oleh semua pecinta film.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sponsor ── */}
        <div className={styles.sectionLabel}>SPONSOR</div>
        <a
          href="https://termai.cc"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.sponsorCard}
        >
          <div className={styles.sponsorGlow} />
          <div className={styles.sponsorContent}>
            <div className={styles.sponsorLeft}>
              <img
                src="https://c.termai.cc/i121/8Fafjz.png"
                alt="Termai Icon"
                className={styles.sponsorIcon}
              />
              <div className={styles.sponsorText}>
                <div className={styles.sponsorLabel}>Didukung oleh</div>
                <div className={styles.sponsorName}>Termai.cc</div>
                <div className={styles.sponsorDesc}>API · Cloud · Store Bot</div>
              </div>
            </div>
            <div className={styles.sponsorArrow}>›</div>
          </div>
        </a>

        {/* ── Footer ── */}
        <div className={styles.footer}>
          <div className={styles.footerLogo}>
            <span className={styles.footerRed}>Flix</span>ify
          </div>
          <div className={styles.footerTagline}>Made with ❤️ by Dev Flixify</div>
          <div className={styles.footerCopy}>© 2026 Flixify · v1.0</div>
          <div className={styles.footerPowered}>Powered by TMDB &amp; Peachify</div>
          <div className={styles.footerSponsor}>
            Sponsored by{' '}
            <a href="https://termai.cc" target="_blank" rel="noopener noreferrer" className={styles.footerSponsorLink}>
              termai.cc
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}