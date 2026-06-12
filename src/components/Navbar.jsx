import styles from './Navbar.module.css'

function getInitials(name = '') {
  return name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U'
}

export default function Navbar({ onSearchOpen, user, onLoginClick, onProfileClick }) {
  return (
    <nav className={styles.nav}>
      <div className={styles.logo}>
        <img src="/logo.png" alt="Flixify" className={styles.logoImg} />
      </div>
      <div className={styles.actions}>
        <button className={styles.btn} onClick={onSearchOpen} aria-label="Cari">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </button>

        {user ? (
          <div className={styles.avatar} title={user.name} onClick={onProfileClick}>
            {getInitials(user.name)}
          </div>
        ) : (
          <button className={styles.loginBtn} onClick={onLoginClick}>
            Masuk
          </button>
        )}
      </div>
    </nav>
  )
}
