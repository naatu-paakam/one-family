/**
 * Supabase Edge Function: generate-description
 * Uses Google Vertex AI (Claude) via a GCP service account.
 * Secret: supabase secrets set GCP_SERVICE_ACCOUNT_JSON='<json>'
 */

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

  // Import the private key
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

  const { title = '', imageUrl, hashtags = [], recentEvents = [] } = await req.json()

  const contextBlock = recentEvents.length
    ? `Recent family updates (last 7 days):\n${recentEvents.map((e: any) => `• ${e.title}`).join('\n')}\n\n`
    : ''

  const userPrompt = `${contextBlock}Write a warm, personal 2–3 sentence description for a family update.\nTitle: "${title}"\nHashtags: ${hashtags.map((t: string) => '#' + t).join(' ') || 'none'}`

  const projectId = JSON.parse(saJson).project_id
  const model = Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-4-6'

  let messageContent: any = [{ type: 'text', text: userPrompt }]

  if (imageUrl) {
    const imgResp = await fetch(imageUrl)
    const imgBuffer = await imgResp.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)))
    const mimeType = (imgResp.headers.get('content-type') ?? 'image/jpeg').split(';')[0]
    messageContent = [
      { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
      { type: 'text', text: userPrompt },
    ]
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
