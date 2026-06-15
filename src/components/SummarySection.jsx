import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { fetchLatestSummary, saveSummary, callEdgeFunction } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format } from 'date-fns'

export default function SummarySection() {
  const { isAdmin } = useAuth()
  const [summary, setSummary] = useState(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetchLatestSummary().then(setSummary).catch(() => {})
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const { summary: text } = await callEdgeFunction('generate-summary', {})
      const saved = await saveSummary(text)
      setSummary(saved)
      toast.success('Summary refreshed!')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setGenerating(false)
    }
  }

  if (!summary && !isAdmin) return null

  return (
    <div className="card p-5 mb-6 border-l-4 border-brand-400 bg-amber-50">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">✨</span>
            <h2 className="font-semibold text-brand-800 text-sm uppercase tracking-wide">Weekly Summary</h2>
            {summary && (
              <span className="text-xs text-stone-400">
                · {format(new Date(summary.created_at), 'MMM d')}
              </span>
            )}
          </div>
          {summary ? (
            <p className="text-stone-700 text-sm leading-relaxed">{summary.content}</p>
          ) : (
            <p className="text-stone-400 text-sm italic">No summary yet. Generate one below.</p>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-secondary text-xs shrink-0"
          >
            {generating ? '⏳ Generating…' : '↺ Refresh'}
          </button>
        )}
      </div>
    </div>
  )
}
