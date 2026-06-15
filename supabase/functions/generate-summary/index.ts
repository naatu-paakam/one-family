/**
 * Supabase Edge Function: generate-summary
 *
 * Deploy: supabase functions deploy generate-summary
 * Secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *
 * Reads the last 7 days of updates from Supabase and generates a weekly summary.
 * Uses the service-role key (set via supabase secrets) to bypass RLS.
 *
 * Update the fetch URL in src/components/SummarySection.jsx from:
 *   /api/generate-summary
 * to:
 *   https://<project-ref>.supabase.co/functions/v1/generate-summary
 */

import Anthropic from 'npm:@anthropic-ai/sdk'
import { createClient } from 'npm:@supabase/supabase-js'

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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const since = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const { data: events, error } = await supabase
    .from('updates')
    .select('title, content, hashtags, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!events?.length) {
    return new Response(JSON.stringify({ summary: 'No updates in the last 7 days. Stay tuned!' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const eventList = events.map((e: any) => `• ${e.title}${e.content ? ' — ' + e.content.slice(0, 150) : ''}`).join('\n')

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-4-6',
    max_tokens: 300,
    system: 'You are a warm family newsletter writer. Keep summaries brief, joyful, and inclusive.',
    messages: [{
      role: 'user',
      content: `Here are this week's family updates:\n${eventList}\n\nWrite a 3–4 sentence summary celebrating these moments.`,
    }],
  })

  const summary = (response.content[0] as any).text.trim()

  return new Response(JSON.stringify({ summary }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
