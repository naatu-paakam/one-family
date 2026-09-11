# Family Vibes — Agent / AI Assistant Guide

This file describes the project for AI coding agents (Claude Code, Codex, Copilot Workspace, etc.).

## Project identity

**App name:** Family Vibes — Making Memories Together  
**Repo:** `codepil/one-family`  
**Purpose:** Private family app — stories, events, invites, family tree, AI summaries.

## Stack (what's actually in use)

| Concern | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite (port 5176) |
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
client/pages/Blogs.tsx          ← stories page (route: /stories — NOT /blogs)
client/pages/Events.tsx         ← events + invite management
client/pages/FamilyTree.tsx     ← interactive tree (flat-node rows, ADR-012)
client/pages/WhyFamilyVibes.tsx ← public marketing/landing page
client/pages/JoinFamily.tsx     ← invite acceptance + onboarding flow
client/pages/FamilySettings.tsx ← family admin settings (name, bio, visibility)
client/pages/Portal.tsx         ← portal admin UI (requires is_portal_admin)
client/pages/PublicEvent.tsx    ← public event view (no auth required, ADR-010)
client/pages/PublicStory.tsx    ← public story view (no auth required, ADR-010)
client/pages/NotFound.tsx       ← 404 fallback
client/components/layout/       ← SiteHeader, SiteFooter
supabase/migrations/            ← SQL migration files (forward-only)
supabase/functions/             ← Edge Functions (Claude AI calls)
public/                         ← static assets (logo.svg, favicon.svg)
index.html                      ← Vite entry; publicDir = root public/
netlify.toml                    ← build config + SPA redirect
e2e/                            ← Playwright test specs (8 files)
docs/adr/                       ← ADR-001 through ADR-012 (binding decisions)
docs/releases/MVP.md            ← current milestone status
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
RESEND_API_KEY           # Only required for TC-AUTH-04 (email invite test); app runs without it
```

The app runs in **demo mode** (no DB calls) if `VITE_SUPABASE_*` vars are absent.

Credentials and local paths live in `.notes` (gitignored). Never commit `.notes` or any file containing real keys.

## Dev commands

```bash
npm install
npm run dev        # http://localhost:5176
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

## Roles and personas system (ADR-001 to ADR-005)

Family Vibes has a **three-tier role model**. Read the relevant ADR before touching any access-controlled feature.

| Tier | Where stored | What it controls |
|---|---|---|
| Portal admin | `profiles.is_portal_admin` | Platform-wide admin UI at `/portal` |
| Family admin | `family_members.role = 'admin'` | Family settings, close events, remove members |
| Family member | `family_members.role = 'member'` | Create stories/events, upload photos |

Key coding rules (ADR-005):
- Use `isFamilyAdmin` / `isPortalAdmin` helpers from `AuthContext` — never compare raw DB fields in JSX.
- Every gated UI element must carry an inline `{/* [ROLE: family_admin] */}` comment.
- Both layers required: client-side gate (UX) AND RLS policy (security). One without the other is a bug.

## Visibility tiers (ADR-010)

Stories and events each carry a `visibility` column with three values:

| Value | Who can see it |
|---|---|
| `family` | Signed-in members of the family only (default) |
| `open` | Any signed-in user (auth.uid() is not null) |
| `public` | Anyone — no auth required |

Rules:
- Public routes (`/public/event/:id`, `/public/story/:id`) must work without a session.
- Open routes require `auth.uid() is not null` in RLS — not just a client guard.
- **Family tree and member list are always `family`-tier** — no visibility column, permanently private.
- Families themselves can have visibility (controls whether family name/bio are discoverable), but this is independent of their content's visibility.
- Every new query on `events` or `updates` must respect the `visibility` column; adding a new query without a visibility filter is a bug.

## Family tree — flat node rows (ADR-012)

The tree is stored as individual rows in `family_tree_nodes`, not as a JSONB blob.

- **Do not write to `family_trees.tree_data`** — that column is legacy; all new code reads/writes `family_tree_nodes`.
- Nodes load lazily: only depth-0 and depth-1 nodes on initial load; deeper nodes expand on demand.
- Nodes beyond depth 1 start **collapsed by default** — never auto-expand the full tree on load.
- All tree reads/writes must be scoped to `family_id` (RLS enforces this, but always include the filter explicitly).

## Story and event RLS patterns (ADR-009)

Stories (`updates` table) and events are assigned to families via junction tables:

- `story_families` — links `update_id` → `family_id`
- `event_families` — links `event_id` → `family_id`

Rules:
- Never filter stories/events with `.eq('family_id', ...)` directly on the `updates` or `events` table.
- Always join through the junction table.
- Creator controls which families see their content. Family admins can only *remove* a story/event from their family — they cannot add one the creator didn't choose.
- Comments inherit visibility from their parent story/event. Never add a `family_id` filter on `comments`.

## QA guidance

All tests live in `e2e/` and run with Playwright.

```bash
npx playwright test                          # all specs
npx playwright test --reporter=html          # generate HTML report
npx playwright test e2e/<file>.spec.ts       # single spec
```

| Spec file | What it covers |
|---|---|
| `sanity.spec.ts` | Core pages load, no JS errors |
| `auth.spec.ts` | Sign-in, sign-out, TC-AUTH-* scenarios |
| `mvp.spec.ts` | MVP acceptance criteria across all features |
| `portal.spec.ts` | Portal admin routes and role gates |
| `regression.spec.ts` | Regression guard for previously fixed bugs |
| `tree.spec.ts` | Family tree CRUD, auto-save, switching families |
| `visibility.spec.ts` | ADR-010 visibility tiers, public routes, open routes |
| `e2e-full.spec.ts` | Full end-to-end user journeys |

Test credentials are in `.notes` (gitignored). Test base URL: `http://localhost:5176`.

`RESEND_API_KEY` must be set for TC-AUTH-04 to pass; all other tests run without it.

After every commit, browser-test the impacted feature — don't rely on the test suite alone.

## DevOps guidance

### Supabase migrations

```bash
# Link project (one-time per machine)
supabase link --project-ref <your-project-ref>

# Apply pending migrations to the linked project
supabase db push --linked

# CAUTION: supabase db query --linked connects to the wrong project in this repo
# — use supabase db push for all migration work, never db query

# Deploy Edge Functions
supabase functions deploy generate-description
supabase functions deploy generate-summary

# Set AI secret (never in .env)
supabase secrets set ANTHROPIC_API_KEY=<your-key>
```

Migrations are forward-only. Never edit an existing file in `supabase/migrations/`. Add a new numbered file for every schema change.

### Netlify deploy

```bash
# Build locally to verify before pushing
npm run build:client    # output → dist/spa/
```

Pushing to `main` triggers an automatic Netlify build. Required Netlify env vars:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

After the first deploy, add the Netlify domain to Supabase → Authentication → URL Configuration → Redirect URLs.

Current stage: **MVP Release 1b — local dev only, not yet pushed to Netlify.** See `docs/releases/MVP.md` for the checklist that gates the Netlify push.

### Pre-push security gate

Run before every `git push`. Must return zero real secrets:

```bash
grep -rn "eyJ\|re_[A-Za-z0-9]\|sk_live" \
  client/ supabase/ public/ \
  --include="*.ts" --include="*.tsx" --include="*.sql" --include="*.json" \
  --exclude-dir=node_modules
```

If any match is a real credential, do not push. Rotate the key and store it in `.notes` or Supabase secrets.
