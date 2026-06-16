# Family Vibes — Agent / AI Assistant Guide

This file describes the project for AI coding agents (Claude Code, Codex, Copilot Workspace, etc.).

## Project identity

**App name:** Family Vibes — Making Memories Together  
**Repo:** `codepil/one-family`  
**Purpose:** Private family app — stories, events, invites, family tree, AI summaries.

## Stack (what's actually in use)

| Concern | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite (port 8080) |
| Styling | TailwindCSS 3 + shadcn/Radix UI primitives |
| Backend | Supabase (Postgres + Auth + RLS + Storage) |
| AI | Claude (Anthropic) via Supabase Edge Functions only |
| Hosting | Netlify static SPA |
| Package manager | **npm** (not pnpm) |

> The `server/` directory exists but is a dev-only Express stub. **Do not add API routes there.** All data access goes through `client/lib/supabase.ts` or Supabase Edge Functions.

## File map — where things live

```
client/lib/supabase.ts          ← all DB queries (fetchUpdates, addInvite, etc.)
client/contexts/AuthContext.tsx ← Supabase Auth session + profile
client/contexts/EventContext.tsx← active events state
client/pages/Index.tsx          ← home page
client/pages/Blogs.tsx          ← stories / posts
client/pages/Events.tsx         ← events + invite management
client/pages/FamilyTree.tsx     ← interactive tree (in-memory)
client/components/layout/       ← SiteHeader, SiteFooter
supabase/migrations/            ← SQL migration files
supabase/functions/             ← Edge Functions (Claude AI calls)
public/                         ← static assets (logo.svg, favicon.svg)
index.html                      ← Vite entry; publicDir = root public/
netlify.toml                    ← build config + SPA redirect
```

## Database tables

| Table | Key columns |
|---|---|
| `profiles` | id (→ auth.users), full_name, avatar_url |
| `updates` | id, title, content, hashtags[], event_id, author_id, status |
| `events` | id, title, description, location, started_at, closed_at, created_by |
| `invites` | id, event_id, full_name, email, status, invited_by |
| `summaries` | id, content, created_at |

RLS is enabled on all tables. All writes require `auth.uid() is not null`.

## Environment variables

```
VITE_SUPABASE_URL        # Required — Supabase project URL
VITE_SUPABASE_ANON_KEY   # Required — public anon key (safe to expose)
ANTHROPIC_API_KEY        # Supabase Edge Function secret ONLY — never in .env or Netlify
```

The app runs in **demo mode** (no DB calls) if `VITE_SUPABASE_*` vars are absent.

## Dev commands

```bash
npm install
npm run dev        # http://localhost:8080
npm run build      # → dist/spa/
npm run typecheck
```

## Key conventions

- **No Express API routes.** Never add handlers to `server/`.
- **No secrets in the browser.** `ANTHROPIC_API_KEY` lives only in Supabase secrets.
- **Vite publicDir is the root `public/`** — static assets go there, not `client/public/`.
- **Migrations only forward.** Never edit existing `.sql` files; add a new migration.
- **RLS always on.** Every new table must have `alter table <t> enable row level security` and at least one policy.
- **Demo guard.** `client/lib/supabase.ts` exports `isDemo` — skip real fetches when true.

## Adding a new feature — checklist

1. DB change → new file in `supabase/migrations/` → `supabase db push --linked`
2. Query/mutation → add to `client/lib/supabase.ts`
3. State → update or add a context in `client/contexts/`
4. UI → add/edit page in `client/pages/` or component in `client/components/`
5. If AI is needed → add/edit an Edge Function in `supabase/functions/`; set secret via `supabase secrets set`

## Deployment

- **Netlify** auto-deploys from `main`. Build: `npm run build:client`. Publish: `dist/spa`.
- **Supabase** migrations: `supabase db push --linked`. Functions: `supabase functions deploy <name>`.
- Required Netlify env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Add Netlify domain to Supabase Auth redirect URLs after first deploy.
