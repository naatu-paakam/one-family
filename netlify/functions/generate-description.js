/**
 * Netlify Function: generate-description
 *
 * Called by the admin form to generate an AI description for a new update.
 * ANTHROPIC_API_KEY is stored as a server-side env var — never exposed to the browser.
 *
 * Supabase Edge Function alternative:
 *   supabase/functions/generate-description/index.ts
 *   Store the key via: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 */

import Anthropic from '@anthropic-ai/sdk'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) }
  }

  let body
  try {
    body = JSON.parse(event.body)
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const { title = '', imageUrl, hashtags = [], recentEvents = [] } = body

  const client = new Anthropic({ apiKey })

  const contextBlock = recentEvents.length
    ? `Recent family updates (last 7 days for context):\n${recentEvents
        .map(e => `• ${e.title}${e.content ? ': ' + e.content.slice(0, 120) : ''}`)
        .join('\n')}\n\n`
    : ''

  const userPrompt = `${contextBlock}Write a warm, personal 2–3 sentence description for a family update.\nTitle: "${title}"\nHashtags: ${hashtags.map(t => '#' + t).join(' ') || 'none'}\nTone: heartfelt, celebratory, conversational.`

  try {
    let messageContent

    if (imageUrl) {
      // Fetch the image and pass it inline to Claude Vision
      const imgResp = await fetch(imageUrl)
      if (!imgResp.ok) throw new Error('Could not fetch image')
      const imgBuffer = await imgResp.arrayBuffer()
      const base64 = Buffer.from(imgBuffer).toString('base64')
      const mimeType = imgResp.headers.get('content-type') ?? 'image/jpeg'

      messageContent = [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: userPrompt },
      ]
    } else {
      messageContent = userPrompt
    }

    const response = await client.messages.create({
      model: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{ role: 'user', content: messageContent }],
      system: 'You are a warm family historian helping document precious family moments. Be concise, joyful, and genuine.',
    })

    const description = response.content[0].text.trim()

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    }
  } catch (err) {
    console.error('Claude API error:', err.message)
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'AI generation failed', detail: err.message }),
    }
  }
}
