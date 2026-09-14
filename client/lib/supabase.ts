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

export type StoryVisibility = 'private' | 'family' | 'open' | 'public'
export type EventVisibility  = 'family' | 'open' | 'public'
export type FamilyVisibility = 'private' | 'open' | 'public'

export async function fetchUpdates({ limit = 50, offset = 0, hashtag, authorId, familyId, visibility }: {
  limit?: number; offset?: number; hashtag?: string; authorId?: string
  familyId?: string | null
  visibility?: StoryVisibility | StoryVisibility[]  // filter by visibility tier
} = {}) {
  if (isDemo) return []
  let query = supabase
    .from('updates')
    .select('*, profiles(full_name, avatar_url), events(id, title, description, started_at, closed_at, created_by, created_at), story_families(family_id)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (hashtag) query = query.contains('hashtags', [hashtag])
  if (authorId) query = query.eq('author_id', authorId)
  if (familyId) query = query.eq('story_families.family_id', familyId)
  if (visibility) {
    const tiers = Array.isArray(visibility) ? visibility : [visibility]
    query = query.in('visibility', tiers)
  }

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

export async function createUpdate(payload: { familyId?: string | null; visibility?: StoryVisibility; [key: string]: any }) {
  const { familyId, ...rest } = payload

  // Generate UUID client-side so we can do a bare INSERT (no RETURNING clause).
  // RETURNING triggers SELECT RLS — for visibility='family' this fails before story_families is linked.
  const newId = crypto.randomUUID()

  // Step 1: Bare INSERT — no .select(), no RETURNING, no RLS SELECT check
  const { error: insertError } = await supabase
    .from('updates')
    .insert({ ...rest, id: newId })
  if (insertError) throw insertError

  // Step 2: Link to family via junction table (ADR-009) — MUST happen before SELECT
  if (familyId && rest.visibility !== 'private') {
    await supabase.rpc('publish_story_to_family', { p_story_id: newId, p_family_id: familyId })
  }

  // Step 3: Now SELECT is safe — story_families entry exists for 'family' visibility
  const { data, error: fetchError } = await supabase
    .from('updates')
    .select('*, profiles(full_name, avatar_url), events(id, title, description, started_at, closed_at, created_by, created_at), story_families(family_id)')
    .eq('id', newId)
    .maybeSingle()
  if (fetchError) throw fetchError
  return data ?? { id: newId, ...rest }
}

export async function setStoryVisibility(storyId: string, visibility: StoryVisibility) {
  const { error } = await supabase.from('updates').update({ visibility }).eq('id', storyId)
  if (error) throw error
}

export async function updateUpdate(id: string, payload: Record<string, any>) {
  // Exclude client-side fields that don't exist on the updates table (ADR-009)
  const { familyId, family_id, ...safePayload } = payload

  const { error } = await supabase
    .from('updates')
    .update({ ...safePayload, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error

  // Fetch the updated row separately — avoids "Cannot coerce to single JSON object"
  // which occurs when visibility='private' changes the SELECT RLS evaluation context
  const { data, error: fetchError } = await supabase
    .from('updates')
    .select('*, profiles(full_name, avatar_url), events(id, title, description, started_at, closed_at, created_by, created_at), story_families(family_id)')
    .eq('id', id)
    .maybeSingle()
  if (fetchError) throw fetchError
  return data ?? { id, ...safePayload }
}

export async function deleteUpdate(id) {
  const { error } = await supabase.from('updates').delete().eq('id', id)
  if (error) throw error
}

export async function deleteEvent(id: string) {
  const { error } = await supabase.from('events').delete().eq('id', id)
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
  // family_id column removed (ADR-009) — filter via event_families junction table
  // !inner forces an INNER JOIN so only events belonging to this family are returned
  let query = supabase
    .from('events')
    .select('*, event_families!inner(family_id)')
    .is('closed_at', null)
    .order('started_at', { ascending: true })
  if (familyId) query = query.eq('event_families.family_id', familyId)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function fetchAllEvents(familyId?: string | null) {
  if (isDemo) return []
  let query = supabase
    .from('events')
    .select('*, event_families(family_id)')
    .order('started_at', { ascending: false })
  if (familyId) query = query.eq('event_families.family_id', familyId)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createEvent({ title, description, location = null, duration = null, familyId = null, visibility = 'family', started_at = null }: {
  title: string; description?: string; location?: string | null; duration?: string | null
  familyId?: string | null; visibility?: EventVisibility; started_at?: string | null
}) {
  const userId = (await supabase.auth.getUser()).data.user?.id
  // Step 1: bare INSERT — no .select() so PostgREST doesn't append RETURNING *.
  // SELECT RLS for visibility='family' requires an event_families row which doesn't exist yet.
  const newId = crypto.randomUUID()
  const { error: insertError } = await supabase
    .from('events')
    .insert({ id: newId, title, description, location, duration, created_by: userId, visibility, started_at })
  if (insertError) throw insertError

  // Step 2: link to family (visibility='family' or any) — creates the event_families row.
  if (familyId) {
    await supabase.rpc('share_event_to_family', { p_event_id: newId, p_family_id: familyId })
  }

  // Step 3: SELECT is now safe — event_families row exists for 'family' visibility.
  const { data, error: fetchError } = await supabase
    .from('events')
    .select('*, event_families(family_id)')
    .eq('id', newId)
    .maybeSingle()
  if (fetchError) throw fetchError
  return data ?? { id: newId, title, description, location, created_by: userId, visibility }
}

export async function setEventVisibility(eventId: string, visibility: EventVisibility) {
  const { error } = await supabase.from('events').update({ visibility }).eq('id', eventId)
  if (error) throw error
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

export async function addInvite(eventId: string, full_name: string, email: string | null, invitedUserId?: string | null) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('invites')
    .insert({ event_id: eventId, full_name, email: email || null, invited_by: user?.id, invited_user_id: invitedUserId ?? null })
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
    .select('role, families(id, name, invite_code, created_by, created_at, enable_video_upload, bio, visibility)')
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

// ── Family Tree Nodes (ADR-012: flat rows replace JSONB blob) ─────────────────

export type FlatTreeNode = {
  id: string
  family_id: string
  parent_id: string | null
  name: string
  born: string | null
  avatar: string | null
  user_id: string | null
  partner_name: string | null
  partner_born: string | null
  partner_user_id: string | null
  email: string | null
  phone: string | null
  address: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export async function fetchFamilyTreeNodes(familyId: string): Promise<FlatTreeNode[]> {
  if (isDemo) return []
  const { data, error } = await supabase
    .from('family_tree_nodes')
    .select('*')
    .eq('family_id', familyId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function upsertTreeNode(node: Partial<FlatTreeNode> & { id: string; family_id: string; name: string }) {
  const { data, error } = await supabase
    .from('family_tree_nodes')
    .upsert({ ...node, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data as FlatTreeNode
}

export async function deleteTreeNode(nodeId: string) {
  // Cascades to children via FK on delete cascade
  const { error } = await supabase.from('family_tree_nodes').delete().eq('id', nodeId)
  if (error) throw error
}

export async function updateTreeNodeParent(nodeId: string, newParentId: string | null, newSortOrder: number) {
  const { error } = await supabase
    .from('family_tree_nodes')
    .update({ parent_id: newParentId, sort_order: newSortOrder, updated_at: new Date().toISOString() })
    .eq('id', nodeId)
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

export const COMMENT_SELECT = '*, profiles!comments_author_id_fkey(full_name, avatar_url), comment_reactions(comment_id, user_id, emoji)'

export async function fetchComments({ eventId, storyId }: { eventId?: string; storyId?: string }) {
  if (isDemo) return []
  let q = supabase.from('comments').select(COMMENT_SELECT).order('created_at', { ascending: true })
  if (eventId) q = q.eq('event_id', eventId)
  else if (storyId) q = q.eq('story_id', storyId)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function createComment(payload: {
  event_id?: string | null
  story_id?: string | null
  author_id: string
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

export async function fetchStoryCommentCounts(storyIds: string[]): Promise<Record<string, number>> {
  if (isDemo || storyIds.length === 0) return {}
  const { data, error } = await supabase.from('comments').select('story_id').in('story_id', storyIds)
  if (error) throw error
  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    if (row.story_id) counts[row.story_id] = (counts[row.story_id] ?? 0) + 1
  }
  return counts
}

export async function deleteComment(id: string) {
  const { error } = await supabase.from('comments').delete().eq('id', id)
  if (error) throw error
}

// ── Family Members list ───────────────────────────────────────────────────────

export async function fetchFamilyMembers(familyId: string) {
  if (isDemo) return []
  const { data, error } = await supabase
    .from('family_members')
    .select('id, user_id, role, joined_at, profiles(id, full_name, avatar_url)')
    .eq('family_id', familyId)
    .order('joined_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

// ── Invitations ───────────────────────────────────────────────────────────────

export async function generateFamilyInvitation(familyId: string): Promise<string> {
  const { data, error } = await supabase.rpc('generate_family_invitation', { p_family_id: familyId })
  if (error) throw error
  return data as string // returns the token UUID
}

export async function joinFamilyByToken(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_family_by_token', { p_token: token })
  if (error) throw error
  return data as string // returns family_id
}

export async function rotateInviteCode(familyId: string): Promise<string> {
  const { data, error } = await supabase.rpc('rotate_invite_code', { p_family_id: familyId })
  if (error) throw error
  return data as string // returns new invite code
}

export async function fetchFamilyInvitations(familyId: string) {
  if (isDemo) return []
  const { data, error } = await supabase
    .from('family_invitations')
    .select('id, token, expires_at, accepted_at, created_at, profiles(full_name)')
    .eq('family_id', familyId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function revokeFamilyInvitation(invitationId: string) {
  const { error } = await supabase.from('family_invitations').delete().eq('id', invitationId)
  if (error) throw error
}

// ── Family bio ────────────────────────────────────────────────────────────────

export async function updateFamilyBio(familyId: string, bio: string) {
  const { error } = await supabase.rpc('update_family_bio', { p_family_id: familyId, p_bio: bio })
  if (error) throw error
}

export async function updateFamilyVisibility(familyId: string, visibility: FamilyVisibility) {
  const { error } = await supabase.rpc('update_family_visibility', { p_family_id: familyId, p_visibility: visibility })
  if (error) throw error
}

// ── Portal admin queries ──────────────────────────────────────────────────────

// Portal admin RPCs — all use security-definer functions that bypass RLS (ADR-002)

export async function fetchAllFamiliesForPortal() {
  if (isDemo) return []
  const { data, error } = await supabase.rpc('portal_fetch_families')
  if (error) throw error
  return data ?? []
}

export async function fetchAllProfiles() {
  if (isDemo) return []
  const { data, error } = await supabase.rpc('portal_fetch_profiles')
  if (error) throw error
  return data ?? []
}

export async function promoteToPortalAdmin(userId: string) {
  const { error } = await supabase.rpc('portal_promote_admin', { p_user_id: userId })
  if (error) throw error
}

export async function demotePortalAdmin(userId: string) {
  const { error } = await supabase.rpc('portal_demote_admin', { p_user_id: userId })
  if (error) throw error
}

export async function leaveFamily(familyId: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('family_id', familyId)
    .eq('user_id', user.id)
  if (error) throw error
}

export async function removeFamilyMember(familyId: string, userId: string) {
  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('family_id', familyId)
    .eq('user_id', userId)
  if (error) throw error
}

export async function deleteFamily(familyId: string) {
  const { error } = await supabase.rpc('portal_delete_family', { p_family_id: familyId })
  if (error) throw error
}

export async function deleteUser(userId: string) {
  const { error } = await supabase.rpc('portal_delete_user', { p_user_id: userId })
  if (error) throw error
}

export async function setFamilyRole(userId: string, familyId: string, role: 'admin' | 'member') {
  const { error } = await supabase.rpc('portal_set_family_role', { p_user_id: userId, p_family_id: familyId, p_role: role })
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
