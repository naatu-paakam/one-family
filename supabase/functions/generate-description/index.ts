/**
 * Supabase Edge Function: generate-description
 * Uses Google Vertex AI (Claude) via a GCP service account.
 * Secret: supabase secrets set GCP_SERVICE_ACCOUNT_JSON='<json>'
 */

import { createClient } from 'npm:@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getGcpAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson)
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  }

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const signingInput = `${encode(header)}.${encode(payload)}`

  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '')
  const keyDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )

  const signatureBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(signingInput)
  )

  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const jwt = `${signingInput}.${signature}`

  const tokenRes = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const tokenData = await tokenRes.json()
  return tokenData.access_token
}

async function callVertexClaude(
  accessToken: string,
  projectId: string,
  model: string,
  system: string,
  messages: object[],
  maxTokens = 400,
): Promise<string> {
  const region = Deno.env.get('VERTEX_REGION') ?? 'us-east5'
  const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/anthropic/models/${model}:rawPredict`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      anthropic_version: 'vertex-2023-10-16',
      max_tokens: maxTokens,
      system,
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Vertex AI error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.content[0].text.trim()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const saJson = Deno.env.get('GCP_SERVICE_ACCOUNT_JSON')
  if (!saJson) {
    return new Response(JSON.stringify({ error: 'GCP_SERVICE_ACCOUNT_JSON not set' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json().catch(() => ({}))
  const {
    title = '',
    content = null,       // user's draft text to enrich
    imageUrl = null,
    hashtags = [],
    eventId = null,       // linked event — fetch its posts for context
    authorId = null,      // author — fetch their recent posts for voice context
    familyId = null,
  } = body

  // ── Fetch context from DB ──────────────────────────────────────────────────
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  type Post = { title: string; content: string | null }
  let eventPosts: Post[] = []
  let authorPosts: Post[] = []

  // Posts on the same event (most relevant context)
  if (eventId) {
    const { data } = await supabase
      .from('updates')
      .select('title, content')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(5)
    eventPosts = data ?? []
  }

  // Author's recent posts in this family (for voice/style context)
  if (authorId) {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
    let q = supabase
      .from('updates')
      .select('title, content')
      .eq('author_id', authorId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(3)
    if (familyId) q = q.eq('family_id', familyId)
    const { data } = await q
    authorPosts = data ?? []
  }

  // ── Build prompt ───────────────────────────────────────────────────────────
  const parts: string[] = []

  if (eventPosts.length > 0) {
    parts.push(
      `Other posts for this event:\n` +
      eventPosts.map(p => `• ${p.title}${p.content ? ': ' + p.content.slice(0, 120) : ''}`).join('\n')
    )
  }

  if (authorPosts.length > 0) {
    parts.push(
      `Recent posts by this author (for tone/voice reference):\n` +
      authorPosts.map(p => `• ${p.title}${p.content ? ': ' + p.content.slice(0, 100) : ''}`).join('\n')
    )
  }

  const contextBlock = parts.length > 0 ? parts.join('\n\n') + '\n\n' : ''

  const draftBlock = content
    ? `The author has started writing:\n"${content}"\n\nEnrich and expand this into a warm, personal 2–3 sentence story — preserve their voice, add vivid detail, and make it feel complete.`
    : `Write a warm, personal 2–3 sentence family story for this post.`

  const userPrompt =
    `${contextBlock}Title: "${title}"\nHashtags: ${hashtags.map((t: string) => '#' + t).join(' ') || 'none'}\n\n${draftBlock}`

  // ── Call Claude ────────────────────────────────────────────────────────────
  const projectId = JSON.parse(saJson).project_id
  const model = Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-4-6'

  let messageContent: any = [{ type: 'text', text: userPrompt }]

  if (imageUrl && !imageUrl.match(/\.(mp4|mov|webm|ogg)(\?|$)/i)) {
    try {
      const imgResp = await fetch(imageUrl)
      const imgBuffer = await imgResp.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)))
      const mimeType = (imgResp.headers.get('content-type') ?? 'image/jpeg').split(';')[0]
      messageContent = [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: userPrompt },
      ]
    } catch {
      // image fetch failed — proceed text-only
    }
  }

  try {
    const accessToken = await getGcpAccessToken(saJson)
    const description = await callVertexClaude(
      accessToken, projectId, model,
      'You are a warm family historian helping document precious family moments. Write in plain prose only — no markdown, no headings, no bullet points, no hashtags in your response.',
      [{ role: 'user', content: messageContent }],
      400,
    )

    return new Response(JSON.stringify({ description }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
