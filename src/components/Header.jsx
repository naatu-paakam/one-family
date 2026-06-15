import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AuthModal from './AuthModal'

export default function Header() {
  const { session, profile, isAdmin, signOut } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  const avatar = session?.user?.user_metadata?.avatar_url

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-stone-200 shadow-sm">
        <div className="container mx-auto px-4 max-w-5xl flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🌾</span>
            <span className="font-display text-xl text-brand-700">NaatuPaakam</span>
          </Link>

          <nav className="flex items-center gap-3">
            {session && (
              <Link
                to="/admin"
                className="text-sm font-medium text-brand-700 hover:text-brand-900 hidden sm:block"
              >
                + New Update
              </Link>
            )}

            {session ? (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {avatar ? (
                    <img src={avatar} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-brand-200 flex items-center justify-center text-brand-800 font-bold text-sm">
                      {(profile?.full_name || session.user.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-stone-200 py-1 text-sm">
                    <p className="px-4 py-2 text-stone-500 truncate">{profile?.full_name || session.user.email}</p>
                    <hr className="my-1 border-stone-100" />
                    <button
                      className="w-full text-left px-4 py-2 hover:bg-amber-50"
                      onClick={() => { navigate('/admin'); setMenuOpen(false) }}
                    >
                      {isAdmin ? 'Admin Panel' : 'My Updates'}
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600"
                      onClick={() => { signOut(); setMenuOpen(false) }}
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="btn-primary text-sm" onClick={() => setShowAuth(true)}>
                Sign In
              </button>
            )}
          </nav>
        </div>
      </header>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </>
  )
}
