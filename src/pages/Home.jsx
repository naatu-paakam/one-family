import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchUpdates } from '../lib/supabase'
import Timeline from '../components/Timeline'
import HashtagStats from '../components/HashtagStats'
import SummarySection from '../components/SummarySection'

export default function Home() {
  const [searchParams] = useSearchParams()
  const activeTag = searchParams.get('tag')

  const [updates, setUpdates] = useState([])
  const [loading, setLoading] = useState(true)
  const [allUpdates, setAllUpdates] = useState([])

  useEffect(() => {
    fetchUpdates({ limit: 100 })
      .then(data => { setAllUpdates(data); setUpdates(data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Filter by active hashtag
  const filtered = activeTag
    ? allUpdates.filter(u => u.hashtags?.includes(activeTag))
    : allUpdates

  return (
    <div>
      <SummarySection />
      <HashtagStats updates={allUpdates} />

      {activeTag && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-stone-500">Filtered by</span>
          <span className="tag text-sm">#{activeTag}</span>
          <a href="/" className="text-xs text-stone-400 hover:text-stone-600 underline">clear</a>
        </div>
      )}

      <Timeline updates={filtered} loading={loading} />
    </div>
  )
}
