import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { fetchActiveEvents, createEvent, closeEvent } from '@/lib/supabase'
import { useFamily } from './FamilyContext'

interface FamilyEvent {
  id: string
  title: string
  description: string | null
  location: string | null
  started_at: string
  closed_at: string | null
  created_by: string
  created_at: string
  family_id: string | null
}

interface EventContextValue {
  activeEvents: FamilyEvent[]
  loading: boolean
  startEvent: (args: { title: string; description: string; location?: string; duration?: string | null; visibility?: 'family' | 'open' | 'public'; started_at?: string | null }) => Promise<FamilyEvent>
  endEvent: (id: string) => Promise<void>
  refresh: () => Promise<void>
}

const EventContext = createContext<EventContextValue | null>(null)

export function EventProvider({ children }: { children: ReactNode }) {
  const [activeEvents, setActiveEvents] = useState<FamilyEvent[]>([])
  const [loading, setLoading] = useState(true)
  const { activeFamilyId } = useFamily()

  const refresh = useCallback(async () => {
    try {
      const events = await fetchActiveEvents(activeFamilyId)
      setActiveEvents(events)
    } catch (e) {
      console.error('EventContext:', e)
    } finally {
      setLoading(false)
    }
  }, [activeFamilyId])

  useEffect(() => { refresh() }, [refresh])

  async function startEvent({ title, description, location, duration, visibility = 'family', started_at }: { title: string; description: string; location?: string; duration?: string | null; visibility?: 'family' | 'open' | 'public'; started_at?: string | null }) {
    const ev = await createEvent({ title, description, location, duration, familyId: activeFamilyId, visibility, started_at })
    setActiveEvents(prev => [...prev, ev])
    return ev
  }

  async function endEvent(id: string) {
    await closeEvent(id)
    setActiveEvents(prev => prev.filter(e => e.id !== id))
  }

  return (
    <EventContext.Provider value={{ activeEvents, loading, startEvent, endEvent, refresh }}>
      {children}
    </EventContext.Provider>
  )
}

export function useEvent() {
  const ctx = useContext(EventContext)
  if (!ctx) throw new Error('useEvent must be used within EventProvider')
  return ctx
}
