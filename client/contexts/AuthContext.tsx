import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase, fetchProfile } from '@/lib/supabase'

const isDemo =
  !import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL.includes('placeholder')

interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  is_admin: boolean
  created_at: string
}

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  authModalOpen: boolean
  openAuthModal: () => void
  closeAuthModal: () => void
  signInWithGoogle: () => Promise<void>
  signInWithFacebook: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  useEffect(() => {
    if (isDemo) { setLoading(false); return }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadProfile(session.user.id, session.user.user_metadata)
      else setLoading(false)
    }).catch(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadProfile(session.user.id, session.user.user_metadata)
      else { setProfile(null); setLoading(false) }
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

  async function signOut() {
    await supabase.auth.signOut()
  }

  const isAdmin = profile?.is_admin === true

  return (
    <AuthContext.Provider value={{ session, profile, loading, isAdmin, authModalOpen, openAuthModal: () => setAuthModalOpen(true), closeAuthModal: () => setAuthModalOpen(false), signInWithGoogle, signInWithFacebook, signInWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
