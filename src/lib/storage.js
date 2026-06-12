/**
 * storage.js — Hybrid localStorage + Firestore
 *
 * Strategi:
 * - Read: localStorage dulu (instant), lalu sync dari Firestore jika user login
 * - Write: localStorage (sync, instant) + Firestore (async, background)
 *
 * Ini menjaga UX tetap cepat (no loading) sambil data tersimpan di cloud.
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'
import { getSession } from './auth'

// ─── localStorage keys ───────────────────────────────────────
const WL_KEY      = 'flixify_watchlist'
const PROG_KEY    = 'flixify_progress'
const HISTORY_KEY = 'flixify_history'

// ─── localStorage helpers ────────────────────────────────────
function localGet(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback }
  catch { return fallback }
}
function localSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* noop */ }
}

// ─── Firestore helpers ───────────────────────────────────────
function getUserId() { return getSession()?.userId || null }

function userDocRef(uid) { return doc(db, 'userData', uid) }

async function firestoreGet(uid) {
  try {
    const snap = await getDoc(userDocRef(uid))
    return snap.exists() ? snap.data() : null
  } catch { return null }
}

async function firestoreSet(uid, data) {
  try {
    await setDoc(userDocRef(uid), { ...data, updatedAt: serverTimestamp() }, { merge: true })
  } catch { /* best-effort */ }
}

// ─── SYNC: pull Firestore → localStorage (call on login) ─────
export async function syncFromCloud() {
  const uid = getUserId()
  if (!uid) return
  const remote = await firestoreGet(uid)
  if (!remote) return
  if (remote.watchlist) localSet(WL_KEY,      remote.watchlist)
  if (remote.history)   localSet(HISTORY_KEY, remote.history)
  if (remote.progress)  localSet(PROG_KEY,    remote.progress)
}

// ─── WATCHLIST ───────────────────────────────────────────────
export function loadWatchlist() { return localGet(WL_KEY, []) }

export function saveWatchlist(list) {
  localSet(WL_KEY, list)
  const uid = getUserId()
  if (uid) firestoreSet(uid, { watchlist: list })
}

// ─── PROGRESS ────────────────────────────────────────────────
export function loadProgress() { return localGet(PROG_KEY, {}) }

export function saveProgress(progress) {
  localSet(PROG_KEY, progress)
  const uid = getUserId()
  if (uid) firestoreSet(uid, { progress })
}

// ─── HISTORY ────────────────────────────────────────────────
export function loadHistory() { return localGet(HISTORY_KEY, []) }

export function saveHistory(list) {
  localSet(HISTORY_KEY, list)
  const uid = getUserId()
  if (uid) firestoreSet(uid, { history: list.slice(0, 50) })
}

export function addToHistory(media) {
  try {
    const existing = loadHistory()
    const filtered = existing.filter((h) => h.id !== media.id)
    const entry = {
      id:           media.id,
      title:        media.title || media.name,
      poster_path:  media.poster_path,
      backdrop_path:media.backdrop_path,
      media_type:   media.media_type || 'movie',
      vote_average: media.vote_average,
      watched_at:   new Date().toISOString(),
      season:       media.season,
      episode:      media.episode,
    }
    const next = [entry, ...filtered].slice(0, 50)
    saveHistory(next)
    return next
  } catch { return [] }
}

export function clearHistory() {
  localSet(HISTORY_KEY, [])
  const uid = getUserId()
  if (uid) firestoreSet(uid, { history: [] })
}
