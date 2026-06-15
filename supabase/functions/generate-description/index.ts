/**
 * Supabase Edge Function: generate-description
 *
 * Deploy: supabase functions deploy generate-description
 * Secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *
 * This is the RECOMMENDED approach — the API key stays inside Supabase's
 * secret store and never touches Netlify or the browser.
 *
 * To use this instead of the Netlify Function, update the fetch URL in
 * src/components/AdminForm.jsx and src/components/EditModal.jsx from:
 *   /api/generate-description
 * to:
 *   https://<project-ref>.supabase.co/functions/v1/generate-description
 * and add the anon key as an Authorization header.
 */

import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { title = '', imageUrl, hashtags = [], recentEvents = [] } = await req.json()

  const contextBlock = recentEvents.length
    ? `Recent family updates (last 7 days):\n${recentEvents.map((e: any) => `• ${e.title}`).join('\n')}\n\n`
    : ''

  const userPrompt = `${contextBlock}Write a warm, personal 2–3 sentence description for a family update.\nTitle: "${title}"\nHashtags: ${hashtags.map((t: string) => '#' + t).join(' ') || 'none'}`

  const client = new Anthropic({ apiKey })

  let messageContent: any = userPrompt

  if (imageUrl) {
    const imgResp = await fetch(imageUrl)
    const imgBuffer = await imgResp.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)))
    const mimeType = imgResp.headers.get('content-type') ?? 'image/jpeg'
    messageContent = [
      { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
      { type: 'text', text: userPrompt },
    ]
  }

  const response = await client.messages.create({
    model: Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-4-6',
    max_tokens: 400,
    system: 'You are a warm family historian helping document precious family moments.',
    messages: [{ role: 'user', content: messageContent }],
  })

  const description = (response.content[0] as any).text.trim()

  return new Response(JSON.stringify({ description }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
