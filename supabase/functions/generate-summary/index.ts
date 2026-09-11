/**
 * Supabase Edge Function: generate-summary
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
  maxTokens = 300,
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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const body = await req.json().catch(() => ({}))
  const familyId: string | undefined = body.familyId

  const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
  let query = supabase
    .from('updates')
    .select('title, content, hashtags, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
  if (familyId) query = query.eq('family_id', familyId)
  const { data: events, error } = await query

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!events?.length) {
    return new Response(JSON.stringify({ summary: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const eventList = events
    .map((e: any) => `• ${e.title}${e.content ? ' — ' + e.content.slice(0, 150) : ''}`)
    .join('\n')

  const projectId = JSON.parse(saJson).project_id
  const model = Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-4-6'

  try {
    const accessToken = await getGcpAccessToken(saJson)
    const summary = await callVertexClaude(
      accessToken, projectId, model,
      'You are a warm, uplifting family storyteller. Your job is to read recent family activity and respond with 2–3 short encouraging sentences that celebrate what the family is doing, make everyone feel seen and valued, and inspire them to keep sharing memories together. Be personal, joyful, and specific to what was shared — never generic. No bullet points, no headers, just heartfelt prose.',
      [{ role: 'user', content: `Here are this week\'s family updates:\n${eventList}\n\nWrite an encouraging 2–3 sentence highlight that celebrates these moments and motivates the family to keep adding more memories.` }],
      300,
    )

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
