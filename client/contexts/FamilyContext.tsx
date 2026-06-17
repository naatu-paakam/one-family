import React, { createContext, useContext, useEffect, useState } from 'react'
import { fetchMyFamilies } from '@/lib/supabase'
import { useAuth } from './AuthContext'

export interface Family {
  id: string
  name: string
  invite_code: string
  created_by: string | null
  created_at: string
  role: 'admin' | 'member'
  enable_video_upload?: boolean
}

interface FamilyContextValue {
  families: Family[]
  activeFamilyId: string | null
  activeFamily: Family | null
  setActiveFamilyId: (id: string) => void
  reload: () => Promise<void>
  loading: boolean
  enableVideoUpload: boolean
}

const FamilyContext = createContext<FamilyContextValue | null>(null)

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const [families, setFamilies] = useState<Family[]>([])
  const [activeFamilyId, setActiveFamilyIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (!session) { setFamilies([]); setActiveFamilyIdState(null); return }
    setLoading(true)
    try {
      const raw = await fetchMyFamilies() as Family[]
      const data = [...raw].sort((a, b) => a.name.localeCompare(b.name))
      setFamilies(data)
      // Restore last active family from localStorage, else default to first alphabetically
      const stored = localStorage.getItem('activeFamilyId')
      const valid = data.find(f => f.id === stored)
      setActiveFamilyIdState(valid ? valid.id : data[0]?.id ?? null)
    } catch (e) {
      console.error('Failed to load families', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [session])

  const setActiveFamilyId = (id: string) => {
    localStorage.setItem('activeFamilyId', id)
    setActiveFamilyIdState(id)
  }

  const activeFamily = families.find(f => f.id === activeFamilyId) ?? null
  const enableVideoUpload = activeFamily?.enable_video_upload ?? false

  return (
    <FamilyContext.Provider value={{ families, activeFamilyId, activeFamily, setActiveFamilyId, reload: load, loading, enableVideoUpload }}>
      {children}
    </FamilyContext.Provider>
  )
}

export function useFamily() {
  const ctx = useContext(FamilyContext)
  if (!ctx) throw new Error('useFamily must be used within FamilyProvider')
  return ctx
}
