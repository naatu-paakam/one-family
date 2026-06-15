import { useState } from 'react'
import toast from 'react-hot-toast'
import { updateUpdate, fetchRecentUpdates } from '../lib/supabase'

export default function EditModal({ update, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: update.title ?? '',
    content: update.content ?? '',
    hashtags: (update.hashtags ?? []).map(t => `#${t}`).join(' '),
  })
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function parseHashtags(raw) {
    return raw
      .split(/[,\s]+/)
      .map(t => t.replace(/^#/, '').trim().toLowerCase())
      .filter(Boolean)
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const recentEvents = await fetchRecentUpdates(7)
      const res = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          imageUrl: update.image_url,
          hashtags: parseHashtags(form.hashtags),
          recentEvents,
        }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const { description } = await res.json()
      set('content', description)
      toast.success('Description regenerated!')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const saved = await updateUpdate(update.id, {
        title: form.title,
        content: form.content,
        hashtags: parseHashtags(form.hashtags),
      })
      toast.success('Update saved!')
      onSaved?.(saved)
      onClose()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl">Edit Update</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={e => set('title', e.target.value)} required />
          </div>

          <div>
            <label className="label">Hashtags</label>
            <input className="input" placeholder="#family #celebration" value={form.hashtags} onChange={e => set('hashtags', e.target.value)} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Description</label>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="text-xs text-brand-600 hover:text-brand-800 font-medium"
              >
                {generating ? '⏳ Generating…' : '✨ Re-generate with AI'}
              </button>
            </div>
            <textarea
              className="input min-h-[120px] resize-y"
              value={form.content}
              onChange={e => set('content', e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
