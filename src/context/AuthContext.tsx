import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { onAuthStateChanged, updateProfile } from 'firebase/auth'
import { auth } from '../firebase'

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
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [guestMessageCount, setGuestMessageCount] = useState<number>(() => {
    try { return parseInt(localStorage.getItem(GUEST_COUNT_KEY) ?? '0', 10) || 0 } catch { return 0 }
  })
  const initializedRef = useRef(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
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

  // Update Firebase display name and force a local re-render by calling reload()
  const saveDisplayName = useCallback(async (name: string) => {
    if (!auth.currentUser) throw new Error('Not signed in')
    await updateProfile(auth.currentUser, { displayName: name })
    await auth.currentUser.reload()
    // Trigger a re-render with the refreshed user object
    setUser({ ...auth.currentUser })
  }, [])

  // Update Firebase photoURL
  const savePhotoURL = useCallback(async (url: string) => {
    if (!auth.currentUser) throw new Error('Not signed in')
    await updateProfile(auth.currentUser, { photoURL: url })
    await auth.currentUser.reload()
    setUser({ ...auth.currentUser })
  }, [])

  const isGuest = !user && !loading
  const guestLimitReached = isGuest && guestMessageCount >= GUEST_MESSAGE_LIMIT

  return (
    <AuthContext.Provider value={{
      user, loading, isGuest, guestMessageCount, guestLimitReached,
      incrementGuestCount, resetGuestCount,
      saveDisplayName, savePhotoURL,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
