/**
 * auth.js — Production Firebase Auth + Firestore
 *
 * Replaces the old localStorage-only auth.
 * Password hashing is handled server-side via bcryptjs in Vercel API routes.
 * Client uses Firebase Auth (email/password) — Firebase hashes passwords automatically.
 *
 * Firestore schema — collection "users":
 *   {
 *     uid:             string  (Firebase Auth UID)
 *     name:            string
 *     email:           string
 *     plan:            'free' | 'premium'
 *     planExpiry:      ISO string | null
 *     watchedToday:    number
 *     lastWatchedDate: string  (toDateString)
 *     createdAt:       ISO string
 *   }
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
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from './firebase'

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function sessionKey() { return 'flixify_session_v2' }

function cacheSession(data) {
  if (data) localStorage.setItem(sessionKey(), JSON.stringify(data))
  else       localStorage.removeItem(sessionKey())
}

export function getSession() {
  try { return JSON.parse(localStorage.getItem(sessionKey()) || 'null') }
  catch { return null }
}

async function fetchUserDoc(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? snap.data() : null
}

function buildSession(uid, data) {
  return {
    userId:          uid,
    name:            data.name  || '',
    email:           data.email || '',
    plan:            data.plan  || 'free',
    planExpiry:      data.planExpiry || null,
    watchedToday:    data.watchedToday    || 0,
    lastWatchedDate: data.lastWatchedDate || null,
  }
}

// ─────────────────────────────────────────────
// AUTH STATE LISTENER  (call once at app root)
// ─────────────────────────────────────────────

export function onSessionChange(callback) {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (!firebaseUser) {
      cacheSession(null)
      callback(null)
      return
    }
    const data = await fetchUserDoc(firebaseUser.uid)
    if (!data) { callback(null); return }
    const session = buildSession(firebaseUser.uid, data)
    cacheSession(session)
    callback(session)
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
// ─────────────────────────────────────────────

export async function updateSession(data) {
  const session = getSession()
  if (!session) return null
  const updated = { ...session, ...data }
  cacheSession(updated)
  // sync subset to Firestore (exclude read-only fields)
  const { userId, ...rest } = updated
  try {
    await updateDoc(doc(db, 'users', userId), rest)
  } catch {
    // best-effort; local cache already updated
  }
  return updated
}

// ─────────────────────────────────────────────
// CAN WATCH
// ─────────────────────────────────────────────

export function canWatch() {
  const session = getSession()
  if (!session) return { allowed: false, reason: 'guest' }

  if (session.plan === 'premium') {
    if (session.planExpiry && new Date(session.planExpiry) > new Date())
      return { allowed: true, reason: 'premium' }
    // expired — fall through to free logic
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
// ACTIVATE PREMIUM  (called after Midtrans success)
// ─────────────────────────────────────────────

export async function activatePremium(plan) {
  const expiry = new Date()
  if (plan === 'monthly') expiry.setDate(expiry.getDate() + 30)
  else                    expiry.setDate(expiry.getDate() + 7)

  return updateSession({ plan: 'premium', planExpiry: expiry.toISOString() })
}

// ─────────────────────────────────────────────
// FIREBASE ERROR → pesan Indonesia
// ─────────────────────────────────────────────

function firebaseError(code) {
  const map = {
    'auth/email-already-in-use':    'Email sudah terdaftar',
    'auth/invalid-email':           'Format email tidak valid',
    'auth/weak-password':           'Password terlalu lemah (min 6 karakter)',
    'auth/user-not-found':          'Email atau password salah',
    'auth/wrong-password':          'Email atau password salah',
    'auth/invalid-credential':      'Email atau password salah',
    'auth/too-many-requests':       'Terlalu banyak percobaan. Coba lagi nanti',
    'auth/network-request-failed':  'Gangguan jaringan. Periksa koneksi internet',
  }
  return map[code] || 'Terjadi kesalahan. Silakan coba lagi'
}
