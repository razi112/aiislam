import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { onAuthStateChanged, updateProfile } from 'firebase/auth'
import { auth } from '../firebase'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

export const GUEST_MESSAGE_LIMIT = 5
const GUEST_COUNT_KEY = 'minnal_guest_msg_count'

interface AuthContextValue {
  user: User | null
  loading: boolean
  isGuest: boolean
  guestMessageCount: number
  guestLimitReached: boolean
  incrementGuestCount: () => void
  resetGuestCount: () => void
  saveDisplayName: (name: string) => Promise<void>
  savePhotoURL: (url: string) => Promise<void>
  localPhotoURL: string | null
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isGuest: false,
  guestMessageCount: 0,
  guestLimitReached: false,
  incrementGuestCount: () => {},
  resetGuestCount: () => {},
  saveDisplayName: async () => {},
  savePhotoURL: async () => {},
  localPhotoURL: null,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [localPhotoURL, setLocalPhotoURL] = useState<string | null>(null)
  const [guestMessageCount, setGuestMessageCount] = useState<number>(() => {
    try { return parseInt(localStorage.getItem(GUEST_COUNT_KEY) ?? '0', 10) || 0 } catch { return 0 }
  })
  const initializedRef = useRef(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)

      // Load profile photo from Firestore (supports base64)
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid, 'profile', 'data'))
          if (snap.exists() && snap.data()?.photoBase64) {
            setLocalPhotoURL(snap.data().photoBase64)
          } else {
            setLocalPhotoURL(firebaseUser.photoURL ?? null)
          }
        } catch {
          setLocalPhotoURL(firebaseUser.photoURL ?? null)
        }
      } else {
        setLocalPhotoURL(null)
      }

      if (!initializedRef.current) {
        initializedRef.current = true
        setLoading(false)
      }
    })

    // Fallback timeout in case Firebase takes too long
    const timeout = setTimeout(() => {
      if (!initializedRef.current) {
        initializedRef.current = true
        setLoading(false)
      }
    }, 1500)

    return () => {
      unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const incrementGuestCount = useCallback(() => {
    setGuestMessageCount((prev) => {
      const next = prev + 1
      try { localStorage.setItem(GUEST_COUNT_KEY, String(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const resetGuestCount = useCallback(() => {
    setGuestMessageCount(0)
    try { localStorage.removeItem(GUEST_COUNT_KEY) } catch { /* ignore */ }
  }, [])

  // Update Firebase display name
  const saveDisplayName = useCallback(async (name: string) => {
    if (!auth.currentUser) throw new Error('Not signed in')
    await updateProfile(auth.currentUser, { displayName: name })
    await auth.currentUser.reload()
    setUser({ ...auth.currentUser })
  }, [])

  // Save photo as base64 in Firestore (Firebase Auth photoURL has a size limit)
  const savePhotoURL = useCallback(async (base64: string) => {
    if (!auth.currentUser) throw new Error('Not signed in')
    const uid = auth.currentUser.uid
    await setDoc(
      doc(db, 'users', uid, 'profile', 'data'),
      { photoBase64: base64 },
      { merge: true }
    )
    setLocalPhotoURL(base64)
  }, [])

  const isGuest = !user && !loading
  const guestLimitReached = isGuest && guestMessageCount >= GUEST_MESSAGE_LIMIT

  return (
    <AuthContext.Provider value={{
      user, loading, isGuest, guestMessageCount, guestLimitReached,
      incrementGuestCount, resetGuestCount,
      saveDisplayName, savePhotoURL, localPhotoURL,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
