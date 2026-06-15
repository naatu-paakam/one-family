import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { fetchUpdateById, deleteUpdate } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import EditModal from '../components/EditModal'

export default function EventDetail() {
  const { id } = useParams()
  const { session, isAdmin } = useAuth()
  const navigate = useNavigate()

  const [update, setUpdate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchUpdateById(id)
      .then(setUpdate)
      .catch(() => toast.error('Update not found'))
      .finally(() => setLoading(false))
  }, [id])

  const canEdit = isAdmin || session?.user?.id === update?.author_id

  async function handleDelete() {
    if (!window.confirm('Delete this update permanently?')) return
    setDeleting(true)
    try {
      await deleteUpdate(id)
      toast.success('Deleted')
      navigate('/')
    } catch (e) {
      toast.error(e.message)
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 max-w-2xl mx-auto">
        <div className="h-6 bg-stone-200 rounded w-1/2" />
        <div className="aspect-video bg-stone-200 rounded-2xl" />
        <div className="h-4 bg-stone-200 rounded w-full" />
        <div className="h-4 bg-stone-200 rounded w-3/4" />
      </div>
    )
  }

  if (!update) {
    return (
      <div className="text-center py-20 text-stone-400">
        <p className="text-4xl mb-3">🔍</p>
        <p>Update not found.</p>
        <Link to="/" className="text-brand-600 underline text-sm mt-2 block">Go home</Link>
      </div>
    )
  }

  const { title, content, image_url, hashtags = [], created_at, updated_at, profiles, ai_generated } = update
  const authorName = profiles?.full_name || 'Family Member'
  const authorAvatar = profiles?.avatar_url

  return (
    <>
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="text-sm text-stone-400 hover:text-stone-600 mb-6 flex items-center gap-1">
          ← Back to timeline
        </Link>

        <article className="card overflow-visible">
          {image_url && (
            <img
              src={image_url}
              alt={title}
              className="w-full rounded-t-2xl object-cover max-h-96"
            />
          )}
          <div className="p-6">
            <h1 className="font-display text-3xl text-stone-900 mb-3">{title}</h1>

            <div className="flex items-center gap-3 mb-4">
              {authorAvatar ? (
                <img src={authorAvatar} alt={authorName} className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-amber-200 flex items-center justify-center text-amber-800 font-bold">
                  {authorName[0].toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-stone-700">{authorName}</p>
                <p className="text-xs text-stone-400">
                  <time dateTime={created_at}>{format(new Date(created_at), 'MMMM d, yyyy · h:mm a')}</time>
                  {updated_at !== created_at && ' · edited'}
                </p>
              </div>
              {ai_generated && (
                <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">✨ AI-generated</span>
              )}
            </div>

            {content && (
              <div className="prose prose-stone prose-sm max-w-none mb-5 text-stone-700 leading-relaxed">
                {content.split('\n').map((para, i) => <p key={i}>{para}</p>)}
              </div>
            )}

            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {hashtags.map(tag => (
                  <Link key={tag} to={`/?tag=${encodeURIComponent(tag)}`} className="tag hover:bg-amber-200 transition">
                    #{tag}
                  </Link>
                ))}
              </div>
            )}

            {canEdit && (
              <div className="flex gap-3 pt-4 border-t border-stone-100">
                <button onClick={() => setEditing(true)} className="btn-secondary text-sm">
                  ✏️ Edit
                </button>
                <button onClick={handleDelete} disabled={deleting} className="text-sm text-red-500 hover:text-red-700 font-medium">
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            )}
          </div>
        </article>
      </div>

      {editing && (
        <EditModal
          update={update}
          onClose={() => setEditing(false)}
          onSaved={saved => setUpdate(u => ({ ...u, ...saved }))}
        />
      )}
    </>
  )
}
