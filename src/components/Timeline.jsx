import EventCard from './EventCard'

export default function Timeline({ updates, loading }) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="h-4 bg-stone-200 rounded w-3/4 mb-3" />
            <div className="h-3 bg-stone-200 rounded w-full mb-2" />
            <div className="h-3 bg-stone-200 rounded w-2/3" />
          </div>
        ))}
      </div>
    )
  }

  if (!updates?.length) {
    return (
      <div className="text-center py-20 text-stone-400">
        <p className="text-5xl mb-4">🌾</p>
        <p className="text-lg font-medium">No updates yet</p>
        <p className="text-sm">Check back soon for family news!</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* vertical line — hidden on mobile */}
      <div className="hidden sm:block timeline-line" />

      <div className="space-y-8">
        {updates.map((update, idx) => {
          const isRight = idx % 2 === 0
          return (
            <div key={update.id} className="relative sm:grid sm:grid-cols-2 sm:gap-8">
              {/* dot on the line */}
              <div className="hidden sm:block absolute left-1/2 top-6 w-4 h-4 rounded-full bg-brand-500 border-2 border-white shadow -translate-x-1/2" />

              {/* left side spacer or card */}
              {isRight ? (
                <>
                  <div className="sm:pr-8">
                    <EventCard update={update} />
                  </div>
                  <div />
                </>
              ) : (
                <>
                  <div />
                  <div className="sm:pl-8">
                    <EventCard update={update} />
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
