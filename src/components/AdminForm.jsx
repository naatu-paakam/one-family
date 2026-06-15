import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { createUpdate, uploadImage, fetchRecentUpdates, callEdgeFunction } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const EMPTY = { title: '', content: '', hashtags: '', imageFile: null, imagePreview: null }

export default function AdminForm({ onCreated }) {
  const { session } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const fileRef = useRef()

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    set('imageFile', file)
    set('imagePreview', URL.createObjectURL(file))
  }

  function parseHashtags(raw) {
    return raw
      .split(/[,\s]+/)
      .map(t => t.replace(/^#/, '').trim().toLowerCase())
      .filter(Boolean)
  }

  async function handleGenerate() {
    if (!form.title && !form.imageFile) {
      toast.error('Add a title or image first')
      return
    }
    setGenerating(true)
    try {
      let uploadedUrl = null
      if (form.imageFile) {
        uploadedUrl = await uploadImage(form.imageFile)
        set('imagePreview', uploadedUrl)
      }

      const recentEvents = await fetchRecentUpdates(7)

      const { description } = await callEdgeFunction('generate-description', {
        title: form.title,
        imageUrl: uploadedUrl,
        hashtags: parseHashtags(form.hashtags),
        recentEvents,
      })
      set('content', description)
      if (uploadedUrl) set('imageFile', null) // already uploaded
      toast.success('Description generated!')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.title) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      let imageUrl = null
      if (form.imageFile) {
        imageUrl = await uploadImage(form.imageFile)
      } else if (form.imagePreview?.startsWith('http')) {
        imageUrl = form.imagePreview
      }

      const payload = {
        title: form.title,
        content: form.content || null,
        image_url: imageUrl,
        hashtags: parseHashtags(form.hashtags),
        author_id: session.user.id,
        ai_generated: generating ? true : undefined,
      }

      const created = await createUpdate(payload)
      toast.success('Update posted!')
      setForm(EMPTY)
      onCreated?.(created)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Image upload */}
      <div>
        <label className="label">Image (optional)</label>
        <div
          className="border-2 border-dashed border-stone-300 rounded-xl p-6 text-center cursor-pointer hover:border-brand-400 transition"
          onClick={() => fileRef.current.click()}
        >
          {form.imagePreview ? (
            <img src={form.imagePreview} alt="preview" className="max-h-48 mx-auto rounded-lg object-contain" />
          ) : (
            <div className="text-stone-400">
              <p className="text-3xl mb-2">📷</p>
              <p className="text-sm">Click to upload a photo</p>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>

      {/* Title */}
      <div>
        <label className="label">Title *</label>
        <input
          className="input"
          placeholder="What's happening in the family?"
          value={form.title}
          onChange={e => set('title', e.target.value)}
          required
        />
      </div>

      {/* Hashtags */}
      <div>
        <label className="label">Hashtags</label>
        <input
          className="input"
          placeholder="#family #celebration #travel"
          value={form.hashtags}
          onChange={e => set('hashtags', e.target.value)}
        />
        <p className="mt-1 text-xs text-stone-400">Separate with spaces or commas</p>
      </div>

      {/* Content / Description */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label mb-0">Description</label>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="text-xs text-brand-600 hover:text-brand-800 font-medium flex items-center gap-1"
          >
            {generating ? '⏳ Generating…' : '✨ Generate with AI'}
          </button>
        </div>
        <textarea
          className="input min-h-[120px] resize-y"
          placeholder="Add a description, or let AI generate one…"
          value={form.content}
          onChange={e => set('content', e.target.value)}
        />
      </div>

      <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
        {saving ? 'Posting…' : 'Post Update'}
      </button>
    </form>
  )
}
