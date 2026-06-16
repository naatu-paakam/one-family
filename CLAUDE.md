# Family Vibes — Claude Code Instructions

## Repo structure

This is the **active** app. The old Vite-only app lives at `../one-family-deprecated/`.

```
client/           # React 18 + TypeScript SPA (Vite)
  pages/          # Index, Blogs (Stories), Events, FamilyTree
  components/
    layout/       # SiteHeader (auth + events), SiteFooter
    ui/           # 30+ shadcn/Radix UI components
  contexts/       # AuthContext, EventContext (Supabase-backed)
  lib/
    supabase.ts   # All Supabase queries + Edge Function calls
server/           # Express stub (dev only — do NOT add routes here)
supabase/
  migrations/     # SQL migration files (forward-only, never edit existing)
  schema.sql      # Full DB schema + RLS policies reference
  functions/      # Edge Functions: generate-description, generate-summary
public/           # Static assets — Vite publicDir (not client/public/)
  logo.svg        # Header/footer icon
  favicon.svg     # Browser tab icon
netlify.toml      # Build config + SPA catch-all redirect
```

## Dev server

```bash
npm install
npm run dev       # http://localhost:8080
npm run build     # production build → dist/spa/
npm run typecheck # TypeScript validation
```

## Environment variables

```
VITE_SUPABASE_URL       # Supabase project URL
VITE_SUPABASE_ANON_KEY  # Supabase anon key (safe to expose)
```

Copy `.env.example` → `.env` and fill in values for local dev.  
The app runs in **demo mode** (no real DB calls) when these are absent.

**Never put `ANTHROPIC_API_KEY` in `.env` or Netlify.** It lives only in Supabase Edge Function secrets.

## Key rules

- **No new Express routes** — all data goes through `client/lib/supabase.ts` or Edge Functions.
- **Static assets in `public/`** — Vite's `publicDir` is the root-level `public/`, not `client/public/`.
- **Migrations are forward-only** — add a new file in `supabase/migrations/`; never edit existing ones.
- **RLS on every table** — new tables must have `enable row level security` + at least one policy.
- **AI secrets stay server-side** — Edge Functions hold the Claude key; it never reaches the browser.

## After every development change — run Playwright tests

Sign in with:
- Email: `test@naatupakam.family`
- Password: `Test123!`
- URL: `http://localhost:8080`

### Checklist

1. **Home page**
   - Loads without errors; real posts/events from Supabase (not sample data)
   - Active events appear as amber badges in the header banner
   - Hero tagline, feature cards, and AI summary section render correctly

2. **Header / Auth**
   - "Join Family" button visible when logged out
   - Sign-in modal: email/password + Google OAuth button
   - After sign-in: avatar appears, "Plan for Event" button visible
   - Active event pills appear below header when events exist
   - Sign out clears session

3. **Stories page** (`/blogs`)
   - Posts load from Supabase (All / Published / Drafts tabs)
   - Clicking a card shows detail in right panel
   - Event badge (🎉 EventName) shown on event-linked posts
   - When signed in: "New Post" button visible
   - Create post: title required; AI generate button populates content
   - Edit/delete only shown if user is author

4. **Events page** (`/events`)
   - Upcoming / Ongoing / Past / All tabs filter correctly
   - Event card shows invite counts (invited / going / pending)
   - Detail panel shows full description, Modify Event, Add Invite form
   - Create event via "+" FAB; AI description generate works
   - Invite status dropdown (invited → accepted/declined) saves to Supabase
   - "Close Event" button visible only to event creator

5. **Family Tree page** (`/family-tree`)
   - Tree renders (in-memory sample data — Supabase not yet wired)
   - Expand/collapse, edit name/born, add child/sibling work

6. **AI generation**
   - Events: enter title + location → "✨ Generate with AI" → prose description fills in
   - Stories: enter title → "✨ Generate with AI" → prose content fills in
   - Both call the `generate-description` Edge Function (requires `ANTHROPIC_API_KEY` secret set)

### Notes
- Google OAuth cannot be automated — test manually
- Family Tree is still in-memory (Phase 2 will add Supabase table)
- AI Edge Functions require `ANTHROPIC_API_KEY` set via `supabase secrets set`

## Deploy to Netlify

### One-time setup
1. Connect repo in Netlify → _Add new site → Import from Git → codepil/one-family_
2. Build settings:
   - Build command: `npm run build:client`
   - Publish directory: `dist/spa`
3. Environment variables (Netlify → Site settings → Environment variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Add the Netlify domain to Supabase → _Authentication → URL Configuration → Redirect URLs_

### Auto-deploy
Pushing to `main` triggers a Netlify build automatically. All routes redirect to `index.html` (configured in `netlify.toml`).

## Deploy Supabase

```bash
# Link project (one-time)
supabase link --project-ref <your-project-ref>

# Apply DB migrations
supabase db push --linked

# Set AI secret (one-time, never in .env)
supabase secrets set ANTHROPIC_API_KEY=<your-key>

# Deploy Edge Functions
supabase functions deploy generate-description
supabase functions deploy generate-summary
```

## Branch workflow

```
main                  ← production (auto-deploys to Netlify)
feat/<name>           ← feature branches → PR → merge to main
```
