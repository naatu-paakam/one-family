import EventCard from './EventCard'

/**
 * Renders a vertical timeline.
 *
 * When some updates belong to an event (have event_id set) and that event has
 * a closed_at date, those updates are grouped into a visual side-branch that
 * originates and merges back into the main spine.
 *
 * Layout sketch (desktop):
 *
 *   [card] ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ [card]
 *              ╲                                                                    ╱
 *               ●──── event card ────●──── event card ────●──── event card ────────●
 *              ╱                                                                    ╲
 *   [card] ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ [card]
 */

function Dot({ className = '' }) {
  return (
    <div className={`w-4 h-4 rounded-full bg-brand-500 border-2 border-white shadow flex-shrink-0 ${className}`} />
  )
}

function EventDot({ className = '' }) {
  return (
    <div className={`w-3 h-3 rounded-full bg-amber-400 border-2 border-white shadow flex-shrink-0 ${className}`} />
  )
}

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

  // Group consecutive event posts into blocks
  // Each segment is either: { type: 'main', items: [...] }
  //                      or: { type: 'event', eventId, eventTitle, items: [...], closed: bool }
  const segments = []
  let i = 0
  while (i < updates.length) {
    const u = updates[i]
    if (u.event_id) {
      const eventId = u.event_id
      const eventTitle = u.events?.title ?? 'Event'
      const closed = !!u.events?.closed_at
      const eventItems = []
      while (i < updates.length && updates[i].event_id === eventId) {
        eventItems.push(updates[i])
        i++
      }
      segments.push({ type: 'event', eventId, eventTitle, closed, items: eventItems })
    } else {
      const mainItems = []
      while (i < updates.length && !updates[i].event_id) {
        mainItems.push(updates[i])
        i++
      }
      segments.push({ type: 'main', items: mainItems })
    }
  }

  return (
    <div className="relative">
      {segments.map((seg, si) => {
        if (seg.type === 'main') {
          return (
            <div key={si} className="relative">
              {/* main spine */}
              <div className="hidden sm:block timeline-line" />
              <div className="space-y-8 pb-2">
                {seg.items.map((update, idx) => {
                  const mainIdx = segments
                    .slice(0, si)
                    .reduce((acc, s) => acc + s.items.length, 0) + idx
                  const isRight = mainIdx % 2 === 0
                  return (
                    <div key={update.id} className="relative sm:grid sm:grid-cols-2 sm:gap-8">
                      <div className="hidden sm:block absolute left-1/2 top-6 -translate-x-1/2">
                        <Dot />
                      </div>
                      {isRight ? (
                        <>
                          <div className="sm:pr-8"><EventCard update={update} /></div>
                          <div />
                        </>
                      ) : (
                        <>
                          <div />
                          <div className="sm:pl-8"><EventCard update={update} /></div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        }

        // event segment — parallel branch
        return (
          <div key={si} className="relative my-2">
            {/* desktop branch layout */}
            <div className="hidden sm:block">
              {/* event header label */}
              <div className="flex items-center justify-center mb-1">
                <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full border border-amber-200">
                  🎉 {seg.eventTitle}
                </span>
              </div>

              {/* branch origin lines — fork off center */}
              <div className="relative flex justify-center">
                {/* left arm of fork */}
                <div className="absolute left-1/2 top-0 -translate-x-1/2 w-px bg-brand-300 h-6" />
              </div>

              {/* event cards in their own right-column lane with amber spine */}
              <div className="relative ml-[50%] pl-8 border-l-2 border-amber-300 space-y-6 py-4">
                {seg.items.map((update) => (
                  <div key={update.id} className="relative">
                    <div className="absolute -left-[17px] top-5">
                      <EventDot />
                    </div>
                    <div className="max-w-sm">
                      <EventCard update={update} variant="event" />
                    </div>
                  </div>
                ))}

                {/* merge label at end */}
                {seg.closed && (
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <div className="absolute -left-[17px]">
                      <EventDot />
                    </div>
                    <span className="pl-2 italic">Event closed · back to main timeline</span>
                  </div>
                )}
              </div>

              {/* rejoin line from branch back to center */}
              <div className="flex justify-center">
                <div className="w-px bg-brand-300 h-6" />
              </div>
            </div>

            {/* mobile: flat list with amber tag */}
            <div className="sm:hidden">
              <div className="flex items-center gap-2 mb-3 mt-1">
                <div className="flex-1 border-t border-amber-300" />
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
                  🎉 {seg.eventTitle}
                </span>
                <div className="flex-1 border-t border-amber-300" />
              </div>
              <div className="space-y-4 pl-3 border-l-2 border-amber-300">
                {seg.items.map(update => (
                  <EventCard key={update.id} update={update} variant="event" />
                ))}
              </div>
              {seg.closed && (
                <div className="text-xs text-amber-600 italic pl-3 mt-2 mb-1">Event closed</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
