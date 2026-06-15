/**
 * Netlify Function: generate-summary
 *
 * Fetches the last 7 days of family updates from Supabase and asks Claude
 * to produce a warm weekly summary displayed on the home page.
 *
 * ANTHROPIC_API_KEY — stored as Netlify env var (server-side only).
 * VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — used server-side only here.
 *
 * Supabase Edge Function alternative: supabase/functions/generate-summary/index.ts
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) }
  }

  // Use service-role key here (server-only) to bypass RLS for reading all updates
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY,
  )

  const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { data: events, error } = await supabase
    .from('updates')
    .select('title, content, hashtags, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  if (error) {
    return { statusCode: 502, body: JSON.stringify({ error: error.message }) }
  }

  if (!events?.length) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: 'No updates in the last 7 days. Stay tuned!' }),
    }
  }

  const eventList = events
    .map(e => `• ${e.title}${e.content ? ' — ' + e.content.slice(0, 150) : ''}`)
    .join('\n')

  const client = new Anthropic({ apiKey })

  try {
    const response = await client.messages.create({
      model: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 300,
      system: 'You are a warm family newsletter writer. Keep summaries brief, joyful, and inclusive.',
      messages: [
        {
          role: 'user',
          content: `Here are this week's family updates:\n${eventList}\n\nWrite a 3–4 sentence summary that captures the highlights and celebrates the family moments. End with a warm closing line.`,
        },
      ],
    })

    const summary = response.content[0].text.trim()

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary }),
    }
  } catch (err) {
    console.error('Claude API error:', err.message)
    return { statusCode: 502, body: JSON.stringify({ error: err.message }) }
  }
}
