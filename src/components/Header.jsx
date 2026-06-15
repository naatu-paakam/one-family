import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useEvent } from '../contexts/EventContext'
import AuthModal from './AuthModal'

function CreateEventModal({ onClose }) {
  const { startEvent } = useEvent()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    setError('')
    try {
      await startEvent({ title: title.trim(), description: description.trim() })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="card w-full max-w-sm p-8">
        <h2 className="text-xl font-display text-stone-900 mb-4">🎉 Create Event</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Event name (e.g. Diwali 2026, Family Reunion)"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            className="input text-sm"
          />
          <textarea
            placeholder="Short description (optional)"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
            className="input text-sm resize-none"
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center text-sm">
              {loading ? 'Starting…' : 'Start Event'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 text-center text-sm text-stone-400 hover:text-stone-600 border border-stone-200 rounded-xl py-2">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Header() {
  const { session, profile, isAdmin, signOut } = useAuth()
  const { activeEvent, endEvent } = useEvent()
  const [showAuth, setShowAuth] = useState(false)
  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  const avatar = profile?.avatar_url || session?.user?.user_metadata?.picture || session?.user?.user_metadata?.avatar_url

  async function handleEventButton() {
    if (activeEvent) {
      if (confirm(`Close event "${activeEvent.title}"?`)) {
        await endEvent()
      }
    } else {
      setShowCreateEvent(true)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-stone-200 shadow-sm">
        <div className="container mx-auto px-4 max-w-5xl flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🌾</span>
            <span className="font-display text-xl text-brand-700">Family Vibes</span>
          </Link>

          <nav className="flex items-center gap-3">
            {session && (
              <>
                <Link
                  to="/admin"
                  className="text-sm font-medium text-brand-700 hover:text-brand-900 hidden sm:block"
                >
                  + New Update
                </Link>

                <button
                  onClick={handleEventButton}
                  className={`text-sm font-medium px-3 py-1.5 rounded-lg border transition hidden sm:block ${
                    activeEvent
                      ? 'border-rose-300 text-rose-600 hover:bg-rose-50'
                      : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  {activeEvent ? `✕ Close Event` : '🎉 Create Event'}
                </button>
              </>
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
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-stone-200 py-1 text-sm">
                    <p className="px-4 py-2 text-stone-500 truncate">{profile?.full_name || session.user.email}</p>
                    <hr className="my-1 border-stone-100" />
                    <button
                      className="w-full text-left px-4 py-2 hover:bg-amber-50"
                      onClick={() => { navigate('/admin'); setMenuOpen(false) }}
                    >
                      {isAdmin ? 'Admin Panel' : 'My Updates'}
                    </button>
                    {/* mobile event button */}
                    <button
                      className={`w-full text-left px-4 py-2 sm:hidden ${activeEvent ? 'text-rose-600 hover:bg-rose-50' : 'text-amber-700 hover:bg-amber-50'}`}
                      onClick={() => { setMenuOpen(false); handleEventButton() }}
                    >
                      {activeEvent ? '✕ Close Event' : '🎉 Create Event'}
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

        {/* Active event banner */}
        {activeEvent && (
          <div className="bg-amber-50 border-t border-amber-200 text-amber-800 text-xs text-center py-1.5 px-4">
            🎉 <strong>{activeEvent.title}</strong> is live — new posts will appear on the event branch
          </div>
        )}
      </header>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showCreateEvent && <CreateEventModal onClose={() => setShowCreateEvent(false)} />}
    </>
  )
}
