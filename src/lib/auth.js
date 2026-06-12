/**
 * auth.js — Production Firebase Auth + Firestore
 *
 * SECURITY FIXES:
 * 1. updateSession() tidak lagi bisa mengubah field plan/planExpiry dari client
 * 2. activatePremium() dihapus dari client — premium HANYA bisa diaktifkan
 *    oleh server (payment-webhook.js via Firebase Admin SDK)
 * 3. onSessionChange selalu re-fetch Firestore (bukan dari cache)
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from './firebase'

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const SESSION_KEY = 'flixify_session_v2'

// Field sensitif yang TIDAK BOLEH diubah dari client
const PROTECTED_FIELDS = ['plan', 'planExpiry', 'userId', 'uid', 'email']

function cacheSession(data) {
  if (data) localStorage.setItem(SESSION_KEY, JSON.stringify(data))
  else       localStorage.removeItem(SESSION_KEY)
}

export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') }
  catch { return null }
}

async function fetchUserDoc(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? snap.data() : null
}

function buildSession(uid, data) {
  return {
    userId:          uid,
    name:            data.name            || '',
    email:           data.email           || '',
    plan:            data.plan            || 'free',
    planExpiry:      data.planExpiry      || null,
    watchedToday:    data.watchedToday    || 0,
    lastWatchedDate: data.lastWatchedDate || null,
  }
}

// ─────────────────────────────────────────────
// AUTH STATE LISTENER
// ─────────────────────────────────────────────
// PENTING: Setiap auth state change (termasuk refresh halaman),
// SELALU fetch fresh dari Firestore — TIDAK pakai cache.
// Ini mencegah cheat via localStorage.

export function onSessionChange(callback) {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      cacheSession(null)
      callback(null)
      return
    }

    try {
      // Force refresh ID token setiap kali — pastikan token valid
      await firebaseUser.getIdToken(true)

      // Fetch data plan dari Firestore (source of truth)
      const data = await fetchUserDoc(firebaseUser.uid)
      if (!data) {
        cacheSession(null)
        callback(null)
        return
      }

      // Overwrite localStorage dengan data asli dari Firestore
      const session = buildSession(firebaseUser.uid, data)
      cacheSession(session)
      callback(session)
    } catch (err) {
      console.error('[auth] onSessionChange error:', err)
      // Jangan pakai cache kalau fetch gagal — lebih aman logout
      cacheSession(null)
      callback(null)
    }
  })
}

// ─────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────

export async function register(name, email, password) {
  if (!name || !email || !password)
    return { success: false, error: 'Semua field wajib diisi' }
  if (password.length < 6)
    return { success: false, error: 'Password minimal 6 karakter' }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
    await updateProfile(cred.user, { displayName: name.trim() })

    const userDoc = {
      uid:             cred.user.uid,
      name:            name.trim(),
      email:           email.toLowerCase().trim(),
      plan:            'free',
      planExpiry:      null,
      watchedToday:    0,
      lastWatchedDate: null,
      createdAt:       new Date().toISOString(),
    }
    await setDoc(doc(db, 'users', cred.user.uid), userDoc)

    const session = buildSession(cred.user.uid, userDoc)
    cacheSession(session)
    return { success: true, user: session }
  } catch (err) {
    return { success: false, error: firebaseError(err.code) }
  }
}

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────

export async function login(email, password) {
  if (!email || !password)
    return { success: false, error: 'Email dan password wajib diisi' }
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
    const data = await fetchUserDoc(cred.user.uid)
    if (!data) return { success: false, error: 'Data user tidak ditemukan' }

    const session = buildSession(cred.user.uid, data)
    cacheSession(session)
    return { success: true, user: session }
  } catch (err) {
    return { success: false, error: firebaseError(err.code) }
  }
}

// ─────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────

export async function logout() {
  await signOut(auth)
  cacheSession(null)
}

// ─────────────────────────────────────────────
// UPDATE SESSION (local cache + Firestore)
// HANYA untuk field NON-SENSITIF seperti watchedToday, lastWatchedDate, name
// Field plan dan planExpiry TIDAK BISA diubah dari sini
// ─────────────────────────────────────────────

export async function updateSession(data) {
  const session = getSession()
  if (!session) return null

  // Buang semua field sensitif — tidak boleh diubah dari client
  const safeData = Object.fromEntries(
    Object.entries(data).filter(([key]) => !PROTECTED_FIELDS.includes(key))
  )

  const updated = { ...session, ...safeData }
  cacheSession(updated)

  const { userId } = updated
  try {
    await updateDoc(doc(db, 'users', userId), safeData)
  } catch {
    // best-effort
  }
  return updated
}

// ─────────────────────────────────────────────
// SYNC SESSION FROM FIRESTORE
// Paksa re-fetch dari Firestore dan update local cache
// Panggil setelah webhook konfirmasi pembayaran berhasil
// ─────────────────────────────────────────────

export async function syncSessionFromFirestore() {
  const currentUser = auth.currentUser
  if (!currentUser) return null

  try {
    await currentUser.getIdToken(true)
    const data = await fetchUserDoc(currentUser.uid)
    if (!data) return null

    const session = buildSession(currentUser.uid, data)
    cacheSession(session)
    return session
  } catch (err) {
    console.error('[auth] syncSessionFromFirestore error:', err)
    return null
  }
}

// ─────────────────────────────────────────────
// CAN WATCH  — baca dari session (sudah di-verify Firestore)
// ─────────────────────────────────────────────

export function canWatch() {
  const session = getSession()
  if (!session) return { allowed: false, reason: 'guest' }

  if (session.plan === 'premium') {
    if (session.planExpiry && new Date(session.planExpiry) > new Date())
      return { allowed: true, reason: 'premium' }
  }

  const today   = new Date().toDateString()
  const watched = session.watchedToday || 0

  if (session.lastWatchedDate !== today || watched < 1)
    return { allowed: true, reason: 'free' }

  return { allowed: false, reason: 'limit' }
}

// ─────────────────────────────────────────────
// RECORD WATCH
// ─────────────────────────────────────────────

export async function recordWatch() {
  const session = getSession()
  if (!session) return
  const today   = new Date().toDateString()
  const watched = session.lastWatchedDate === today
    ? (session.watchedToday || 0) + 1
    : 1
  await updateSession({ watchedToday: watched, lastWatchedDate: today })
}

// ─────────────────────────────────────────────
// GET FIREBASE ID TOKEN
// ─────────────────────────────────────────────

export async function getIdToken() {
  try {
    const user = auth.currentUser
    if (!user) return null
    return await user.getIdToken()
  } catch { return null }
}

// ─────────────────────────────────────────────
// FIREBASE ERROR → pesan Indonesia
// ─────────────────────────────────────────────

function firebaseError(code) {
  const map = {
    'auth/email-already-in-use':   'Email sudah terdaftar',
    'auth/invalid-email':          'Format email tidak valid',
    'auth/weak-password':          'Password terlalu lemah (min 6 karakter)',
    'auth/user-not-found':         'Email atau password salah',
    'auth/wrong-password':         'Email atau password salah',
    'auth/invalid-credential':     'Email atau password salah',
    'auth/too-many-requests':      'Terlalu banyak percobaan. Coba lagi nanti',
    'auth/network-request-failed': 'Gangguan jaringan. Periksa koneksi internet',
  }
  return map[code] || 'Terjadi kesalahan. Silakan coba lagi'
}
