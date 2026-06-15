import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, fetchProfile } from '../lib/supabase'

const isDemo =
  !import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL.includes('placeholder')

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

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

  async function loadProfile(userId, userMeta) {
    try {
      let p = await fetchProfile(userId)
      // Sync avatar/name from OAuth metadata if profile is missing them
      if (userMeta && p && (!p.avatar_url || !p.full_name)) {
        const patch = {}
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

  async function signOut() {
    await supabase.auth.signOut()
  }

  const isAdmin = profile?.is_admin === true

  return (
    <AuthContext.Provider value={{ session, profile, loading, isAdmin, signInWithGoogle, signInWithFacebook, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
