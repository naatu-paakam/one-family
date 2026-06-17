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

export async function fetchUpdates({ limit = 50, offset = 0, hashtag, authorId, familyId }: {
  limit?: number; offset?: number; hashtag?: string; authorId?: string; familyId?: string | null
} = {}) {
  if (isDemo) return []
  let query = supabase
    .from('updates')
    .select('*, profiles(full_name, avatar_url), events(id, title, description, started_at, closed_at, created_by, created_at)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (hashtag) query = query.contains('hashtags', [hashtag])
  if (authorId) query = query.eq('author_id', authorId)
  if (familyId) query = query.eq('family_id', familyId)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function fetchUpdateById(id) {
  if (isDemo) return null
  const { data, error } = await supabase
    .from('updates')
    .select('*, profiles(full_name, avatar_url), events(id, title, description, started_at, closed_at, created_by, created_at)')
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

export async function uploadImage(file: File, familyId?: string | null) {
  const ext = file.name.split('.').pop()
  const basename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const path = familyId ? `${familyId}/${basename}` : `shared/${basename}`
  const { error } = await supabase.storage
    .from('update-images')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error

  const { data } = supabase.storage.from('update-images').getPublicUrl(path)
  return data.publicUrl
}

// ── Events ────────────────────────────────────────────────────────────────────

export async function fetchActiveEvents(familyId?: string | null) {
  if (isDemo) return []
  let query = supabase
    .from('events')
    .select('*')
    .is('closed_at', null)
    .order('started_at', { ascending: true })
  if (familyId) query = query.eq('family_id', familyId)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createEvent({ title, description, location = null, familyId = null }: {
  title: string; description?: string; location?: string | null; familyId?: string | null
}) {
  const { data, error } = await supabase
    .from('events')
    .insert({ title, description, location, family_id: familyId, created_by: (await supabase.auth.getUser()).data.user?.id })
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

export async function updateEvent(id, patch) {
  const { data, error } = await supabase
    .from('events')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Invites ───────────────────────────────────────────────────────────────────

export async function fetchAllInvites(eventIds: string[]) {
  if (isDemo || eventIds.length === 0) return []
  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .in('event_id', eventIds)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function addInvite(eventId: string, full_name: string, email: string | null) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('invites')
    .insert({ event_id: eventId, full_name, email: email || null, invited_by: user?.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateInviteStatus(id: string, status: string) {
  const { data, error } = await supabase
    .from('invites')
    .update({ status })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteInvite(id: string) {
  const { error } = await supabase.from('invites').delete().eq('id', id)
  if (error) throw error
}

// ── Families ──────────────────────────────────────────────────────────────────

export async function fetchMyFamilies() {
  if (isDemo) return []
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('family_members')
    .select('role, families(id, name, invite_code, created_by, created_at)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(row => ({ ...(row.families as any), role: row.role }))
}

export async function createFamily(name: string) {
  const { data, error } = await supabase.rpc('create_family', { p_name: name })
  if (error) throw error
  return data as { id: string; name: string; invite_code: string; created_by: string; created_at: string }
}

export async function joinFamilyByCode(inviteCode: string) {
  const { data, error } = await supabase.rpc('join_family_by_code', { p_invite_code: inviteCode.trim() })
  if (error) throw error
  return data as { id: string; name: string; invite_code: string; created_by: string; created_at: string }
}

// ── Family Trees ──────────────────────────────────────────────────────────────

export async function fetchFamilyTree(familyId: string) {
  if (isDemo) return null
  const { data, error } = await supabase
    .from('family_trees')
    .select('tree_data')
    .eq('family_id', familyId)
    .maybeSingle()
  if (error) throw error
  return data?.tree_data ?? null
}

export async function saveFamilyTree(familyId: string, treeData: object) {
  const { error } = await supabase
    .from('family_trees')
    .upsert({ family_id: familyId, tree_data: treeData, updated_at: new Date().toISOString() },
             { onConflict: 'family_id' })
  if (error) throw error
}

// ── Family Members ────────────────────────────────────────────────────────────

export async function fetchFamilyMemberCount(familyId: string) {
  if (isDemo) return 0
  const { count, error } = await supabase
    .from('family_members')
    .select('*', { count: 'exact', head: true })
    .eq('family_id', familyId)
  if (error) throw error
  return count ?? 0
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function fetchCommentCounts(eventIds: string[]): Promise<Record<string, number>> {
  if (isDemo || eventIds.length === 0) return {}
  const { data, error } = await supabase
    .from('comments')
    .select('event_id')
    .in('event_id', eventIds)
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.event_id] = (counts[row.event_id] ?? 0) + 1
  }
  return counts
}

const COMMENT_SELECT = '*, profiles!comments_author_id_fkey(full_name, avatar_url), comment_reactions(comment_id, user_id, emoji)'

export async function fetchComments(eventId: string) {
  if (isDemo) return []
  const { data, error } = await supabase
    .from('comments')
    .select(COMMENT_SELECT)
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createComment(payload: {
  event_id: string
  author_id: string
  family_id: string
  content: string | null
  image_url: string | null
  parent_id: string | null
}) {
  const { data, error } = await supabase
    .from('comments')
    .insert(payload)
    .select(COMMENT_SELECT)
    .single()
  if (error) throw error
  return data
}

export async function deleteComment(id: string) {
  const { error } = await supabase.from('comments').delete().eq('id', id)
  if (error) throw error
}

export async function toggleReaction(commentId: string, userId: string, emoji: string) {
  // Check if reaction exists
  const { data: existing } = await supabase
    .from('comment_reactions')
    .select('*')
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('comment_reactions')
      .delete()
      .eq('comment_id', commentId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
    if (error) throw error
    return false // removed
  } else {
    const { error } = await supabase
      .from('comment_reactions')
      .insert({ comment_id: commentId, user_id: userId, emoji })
    if (error) throw error
    return true // added
  }
}
