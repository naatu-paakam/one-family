import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { fetchActiveEvent, createEvent, closeEvent } from '../lib/supabase'

const EventContext = createContext(null)

export function EventProvider({ children }) {
  const [activeEvent, setActiveEvent] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const ev = await fetchActiveEvent()
      setActiveEvent(ev)
    } catch (e) {
      console.error('EventContext:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function startEvent({ title, description }) {
    const ev = await createEvent({ title, description })
    setActiveEvent(ev)
    return ev
  }

  async function endEvent() {
    if (!activeEvent) return
    await closeEvent(activeEvent.id)
    setActiveEvent(null)
  }

  return (
    <EventContext.Provider value={{ activeEvent, loading, startEvent, endEvent, refresh }}>
      {children}
    </EventContext.Provider>
  )
}

export function useEvent() {
  const ctx = useContext(EventContext)
  if (!ctx) throw new Error('useEvent must be used within EventProvider')
  return ctx
}
