import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AdminForm from '../components/AdminForm'
import { fetchUpdates, deleteUpdate } from '../lib/supabase'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

export default function Admin() {
  const { session, isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [updates, setUpdates] = useState([])

  useEffect(() => {
    if (!loading && (!session || !isAdmin)) {
      navigate('/')
    }
  }, [session, isAdmin, loading, navigate])

  useEffect(() => {
    if (isAdmin) {
      fetchUpdates({ limit: 20 }).then(setUpdates).catch(console.error)
    }
  }, [isAdmin])

  function handleCreated(update) {
    setUpdates(u => [update, ...u])
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this update?')) return
    try {
      await deleteUpdate(id)
      setUpdates(u => u.filter(x => x.id !== id))
      toast.success('Deleted')
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (loading) return null

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-3xl text-stone-900 mb-1">Admin Panel</h1>
        <p className="text-stone-500 text-sm">Post new family updates and manage existing ones.</p>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-stone-700 mb-4">New Update</h2>
        <AdminForm onCreated={handleCreated} />
      </div>

      {updates.length > 0 && (
        <div>
          <h2 className="font-semibold text-stone-700 mb-3">Recent Updates</h2>
          <div className="space-y-2">
            {updates.map(u => (
              <div key={u.id} className="card p-3 flex items-center gap-3">
                {u.image_url && (
                  <img src={u.image_url} alt={u.title} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-stone-800 truncate">{u.title}</p>
                  <p className="text-xs text-stone-400">{format(new Date(u.created_at), 'MMM d, yyyy')}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => navigate(`/event/${u.id}`)}
                    className="text-xs text-brand-600 hover:text-brand-800"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleDelete(u.id)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
