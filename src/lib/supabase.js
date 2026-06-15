import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️  Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — running in demo mode')
}

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder',
  {
    // Disable retries so network errors fail fast (no retry storm in dev)
    global: { fetch: (url, opts) => fetch(url, { ...opts, signal: opts?.signal }) },
    auth: { persistSession: true, autoRefreshToken: true },
    db: { schema: 'public' },
    realtime: { timeout: 5000 },
  },
)

// ── Demo-mode guard ───────────────────────────────────────────────────────────
// Skip real fetches when credentials are absent or are the placeholder values
const isDemo =
  !import.meta.env.VITE_SUPABASE_URL ||
  !import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_URL.includes('placeholder') ||
  import.meta.env.VITE_SUPABASE_ANON_KEY === 'placeholder'

// ── Updates ──────────────────────────────────────────────────────────────────

export async function fetchUpdates({ limit = 50, offset = 0, hashtag, authorId } = {}) {
  if (isDemo) return []
  let query = supabase
    .from('updates')
    .select('*, profiles(full_name, avatar_url), events(id, title, closed_at)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (hashtag) query = query.contains('hashtags', [hashtag])
  if (authorId) query = query.eq('author_id', authorId)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function fetchUpdateById(id) {
  if (isDemo) return null
  const { data, error } = await supabase
    .from('updates')
    .select('*, profiles(full_name, avatar_url), events(id, title, closed_at)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function fetchRecentUpdates(days = 7) {
  if (isDemo) return []
  const since = new Date(Date.now() - days * 86400_000).toISOString()
  const { data, error } = await supabase
    .from('updates')
    .select('id, title, content, hashtags, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createUpdate(payload) {
  const { data, error } = await supabase
    .from('updates')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateUpdate(id, payload) {
  const { data, error } = await supabase
    .from('updates')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteUpdate(id) {
  const { error } = await supabase.from('updates').delete().eq('id', id)
  if (error) throw error
}

// ── Summaries ─────────────────────────────────────────────────────────────────

export async function fetchLatestSummary() {
  if (isDemo) return null
  const { data, error } = await supabase
    .from('summaries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

export async function saveSummary(content) {
  const { data, error } = await supabase
    .from('summaries')
    .insert({ content })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Profiles ──────────────────────────────────────────────────────────────────

export async function fetchProfile(userId) {
  if (isDemo) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data ?? null
}

// ── Edge Functions ────────────────────────────────────────────────────────────

export async function callEdgeFunction(name, body) {
  const base = import.meta.env.VITE_SUPABASE_URL
  const key  = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!base || base.includes('placeholder')) {
    throw new Error('Supabase not configured — set VITE_SUPABASE_URL in .env')
  }

  const res = await fetch(`${base}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // anon key authorises the call; the function itself holds the Claude key
      'Authorization': `Bearer ${key}`,
      'apikey': key,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Edge function "${name}" failed (${res.status})`)
  }
  return res.json()
}

// ── Storage ───────────────────────────────────────────────────────────────────

export async function uploadImage(file) {
  const ext = file.name.split('.').pop()
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage
    .from('update-images')
    .upload(filename, file, { cacheControl: '3600', upsert: false })
  if (error) throw error

  const { data } = supabase.storage.from('update-images').getPublicUrl(filename)
  return data.publicUrl
}

// ── Events ────────────────────────────────────────────────────────────────────

export async function fetchActiveEvent() {
  if (isDemo) return null
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .is('closed_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createEvent({ title, description }) {
  const { data, error } = await supabase
    .from('events')
    .insert({ title, description, created_by: (await supabase.auth.getUser()).data.user?.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function closeEvent(id) {
  const { data, error } = await supabase
    .from('events')
    .update({ closed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
