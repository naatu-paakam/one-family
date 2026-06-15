import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function HashtagStats({ updates }) {
  const [activeTag, setActiveTag] = useState(null)
  const navigate = useNavigate()

  const tagCounts = useMemo(() => {
    const counts = {}
    for (const u of updates ?? []) {
      for (const tag of u.hashtags ?? []) {
        counts[tag] = (counts[tag] ?? 0) + 1
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
  }, [updates])

  if (!tagCounts.length) return null

  const maxCount = tagCounts[0]?.[1] ?? 1

  function handleTag(tag) {
    if (activeTag === tag) {
      setActiveTag(null)
      navigate('/')
    } else {
      setActiveTag(tag)
      navigate(`/?tag=${encodeURIComponent(tag)}`)
    }
  }

  return (
    <div className="card p-5 mb-6">
      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Trending Topics</h2>
      <div className="flex flex-wrap gap-2">
        {tagCounts.map(([tag, count]) => {
          const weight = 0.7 + (count / maxCount) * 0.8
          const isActive = activeTag === tag
          return (
            <button
              key={tag}
              onClick={() => handleTag(tag)}
              className={`tag transition-all hover:bg-amber-200 cursor-pointer ${isActive ? 'bg-brand-500 text-white hover:bg-brand-600' : ''}`}
              style={{ fontSize: `${weight}rem` }}
            >
              #{tag}
              <span className="ml-1 text-xs opacity-70">{count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
