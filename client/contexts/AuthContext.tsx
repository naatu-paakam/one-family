import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase, fetchProfile, callEdgeFunction } from '@/lib/supabase'

const isDemo =
  !import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL.includes('placeholder')

interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  is_portal_admin: boolean  // renamed from is_admin (ADR-002)
  created_at: string
}

interface AuthModalOptions {
  defaultTab?: 'signin' | 'signup'
  redirectTo?: string   // navigate here after successful sign-in
}

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isPortalAdmin: boolean
  authModalOpen: boolean
  authModalOptions: AuthModalOptions
  openAuthModal: (opts?: AuthModalOptions) => void
  closeAuthModal: () => void
  signInWithGoogle: () => Promise<void>
  signInWithFacebook: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalOptions, setAuthModalOptions] = useState<AuthModalOptions>({})

  useEffect(() => {
    if (isDemo) { setLoading(false); return }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile(session.user.id, session.user.user_metadata)
      else setLoading(false)
    }).catch(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (session) {
        loadProfile(session.user.id, session.user.user_metadata)
        // Trigger a fresh AI summary on every real sign-in (not on session restore)
        if (event === 'SIGNED_IN') {
          callEdgeFunction('generate-summary', {}).catch(() => {/* best-effort */})
        }
      } else {
        setProfile(null); setLoading(false)
      }
    })

    return () => subscription?.unsubscribe()
  }, [])

  async function loadProfile(userId: string, userMeta: User['user_metadata']) {
    try {
      let p = await fetchProfile(userId)
      if (userMeta && p && (!p.avatar_url || !p.full_name)) {
        const patch: Partial<Profile> = {}
        if (!p.avatar_url) patch.avatar_url = userMeta.avatar_url || userMeta.picture || null
        if (!p.full_name)  patch.full_name  = userMeta.full_name  || userMeta.name   || null
        if (Object.keys(patch).length) {
          const { data } = await supabase.from('profiles').update(patch).eq('id', userId).select().single()
          if (data) p = data
        }
      }
      setProfile(p)
    } finally {
      setLoading(false)
    }
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  async function signInWithFacebook() {
    await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: window.location.origin },
    })
  }

  async function signInWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUpWithEmail(email: string, password: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  const isPortalAdmin = profile?.is_portal_admin === true

  function openAuthModal(opts: AuthModalOptions = {}) {
    setAuthModalOptions(opts)
    setAuthModalOpen(true)
  }

  function closeAuthModal() {
    setAuthModalOpen(false)
    setAuthModalOptions({})
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, isPortalAdmin, authModalOpen, authModalOptions, openAuthModal, closeAuthModal, signInWithGoogle, signInWithFacebook, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
