import { getApp, getApps, initializeApp } from 'firebase/app'
import { GoogleAuthProvider, createUserWithEmailAndPassword, getAuth, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut, updateProfile, type User } from 'firebase/auth'
import { getDatabase, ref, update } from 'firebase/database'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
}

export const firebaseEnabled = Boolean(config.apiKey && config.authDomain && config.databaseURL && config.projectId)
const app = firebaseEnabled ? (getApps().length ? getApp() : initializeApp(config)) : undefined
export const auth = app ? getAuth(app) : undefined
export const database = app ? getDatabase(app) : undefined
export function waitForAuthState(): Promise<User | null> {
  if (!auth) return Promise.resolve(null)
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => { unsubscribe(); resolve(user) })
  })
}
export async function signInWithEmail(email: string, password: string): Promise<User> {
  if (!auth) throw new Error('Firebase 尚未設定。')
  return (await signInWithEmailAndPassword(auth, email, password)).user
}

export async function registerWithEmail(email: string, password: string): Promise<User> {
  if (!auth) throw new Error('Firebase 尚未設定。')
  return (await createUserWithEmailAndPassword(auth, email, password)).user
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (!auth) throw new Error('Firebase 尚未設定。')
  await sendPasswordResetEmail(auth, email)
}

export async function signInWithGoogle(): Promise<User | null> {
  if (!auth) throw new Error('Firebase 尚未設定。')
  const provider = new GoogleAuthProvider()
  try {
    return (await signInWithPopup(auth, provider)).user
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider)
      return null
    }
    throw error
  }
}

export async function logOut(): Promise<void> { if (auth) await signOut(auth) }

export async function ensureUserProfile(user: User): Promise<void> {
  if (!database || !user.email) return
  const emailKey = user.email.toLowerCase().replace(/[.#$\[\]/]/g, '_')
  await update(ref(database), { [`users/${user.uid}/displayName`]: user.displayName || user.email.split('@')[0], [`users/${user.uid}/email`]: user.email, [`users/${user.uid}/updatedAt`]: Date.now(), [`emailIndex/${emailKey}`]: user.uid })
}

export async function updateUserSettings(user: User, settings: { displayName: string; defaultCurrency: string; timezone: string }): Promise<void> {
  const displayName = settings.displayName.trim() || user.email?.split('@')[0] || 'TripMate 使用者'
  await updateProfile(user, { displayName })
  if (database) await update(ref(database, `users/${user.uid}`), { displayName, defaultCurrency: settings.defaultCurrency, timezone: settings.timezone, updatedAt: Date.now() })
}
