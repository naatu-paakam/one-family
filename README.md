# Family Vibes — Making Memories Together

A private family app for sharing stories, planning events, and building an interactive family tree. Backed by Supabase (Postgres + Auth + Edge Functions) and deployed as a static SPA on Netlify.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | TailwindCSS 3 + shadcn/Radix UI |
| Backend / DB | Supabase (Postgres, Auth, RLS, Storage) |
| AI | Claude via Supabase Edge Functions (server-side only) |
| Hosting | Netlify (static SPA) |
| CI/CD | GitHub → Netlify auto-deploy on push to `main` |

## Features

- **Stories** — write, tag, and publish family posts; attach to events; AI-generated descriptions
- **Events** — create upcoming/ongoing/past gatherings with location; manage RSVP invites per event
- **Family Tree** — interactive expandable tree, persisted per-family in Supabase (`family_trees` table)
- **AI Summaries** — Claude generates event descriptions and blog content via Edge Functions
- **Auth** — email/password + Google OAuth via Supabase Auth

## Repo Layout

```
client/                    # React SPA (Vite)
  pages/                   # Index, Blogs, Events, FamilyTree
  components/
    layout/                # SiteHeader, SiteFooter
    ui/                    # shadcn-style Radix components
  contexts/                # AuthContext, EventContext
  lib/
    supabase.ts            # All Supabase queries + Edge Function calls
supabase/
  migrations/              # SQL migrations (applied via Supabase CLI)
  functions/               # Edge Functions: generate-description, generate-summary
  schema.sql               # Full DB schema + RLS policies
public/                    # Static assets (logo, favicon)
index.html                 # Vite entry point
netlify.toml               # Build config + SPA redirect rule
```

## Local Development

### Prerequisites

- Node 18+
- npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for migrations)

### Setup

```bash
# Install dependencies
npm install

# Copy env template and fill in values
cp .env.example .env
```

`.env` requires:

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

> The app runs in **demo mode** (no DB calls) if these are missing — useful for UI-only work.

```bash
# Start dev server at http://localhost:8080
npm run dev

# Production build → dist/spa/
npm run build
```

## Database

### Schema overview

| Table | Purpose |
|---|---|
| `profiles` | One row per auth user (full_name, avatar_url) |
| `updates` | Family stories/posts (title, content, hashtags, event link) |
| `events` | Gatherings (title, description, location, started_at, closed_at) |
| `invites` | Per-event RSVPs (full_name, email, status, invited_by) |
| `summaries` | AI-generated weekly summaries |

Row-Level Security is enabled on all tables. Policies allow public read; writes require `auth.uid() is not null`.

### Applying migrations

```bash
# Link to your Supabase project (one-time)
supabase link --project-ref <your-project-ref>

# Push all migrations to remote
supabase db push --linked
```

Migration files live in `supabase/migrations/`. Never edit them retroactively — add a new migration file for schema changes.

## AI Edge Functions

Edge Functions run server-side on Supabase — the Claude API key never touches the browser or Netlify.

| Function | Trigger | What it does |
|---|---|---|
| `generate-description` | Button click in UI | Generates a warm prose description for an event or blog post title |
| `generate-summary` | Scheduled / manual | Summarises recent family activity into a weekly snapshot |

### Secrets (set once in Supabase dashboard)

```bash
supabase secrets set ANTHROPIC_API_KEY=<your-key>
```

### Deploy functions

```bash
supabase functions deploy generate-description
supabase functions deploy generate-summary
```

## Deployment

### Netlify (production)

The app deploys automatically when `main` is updated on GitHub.

**One-time Netlify setup:**

1. Connect the GitHub repo in Netlify → _Add new site → Import from Git_
2. Set build settings:
   - Build command: `npm run build:client`
   - Publish directory: `dist/spa`
3. Add environment variables under _Site settings → Environment variables_:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Add the Netlify domain to Supabase → _Authentication → URL Configuration → Redirect URLs_

`netlify.toml` already handles SPA routing (all paths redirect to `index.html`).

### Supabase (production)

| Step | Where |
|---|---|
| Create project | [supabase.com](https://supabase.com) |
| Apply migrations | `supabase db push --linked` |
| Set Edge Function secrets | Supabase dashboard → Edge Functions → Secrets |
| Deploy Edge Functions | `supabase functions deploy <name>` |
| Enable Google OAuth | Supabase dashboard → Authentication → Providers |

### Environment variable checklist

| Variable | Where to set | Required |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env` (local) + Netlify | Yes |
| `VITE_SUPABASE_ANON_KEY` | `.env` (local) + Netlify | Yes |
| `ANTHROPIC_API_KEY` | Supabase secrets only | Yes (AI features) |

> **Security:** `ANTHROPIC_API_KEY` is stored exclusively in Supabase Edge Function secrets. It is never in `.env`, never in Netlify, and never shipped to the browser.

## Branch & PR Workflow

```
main              ← production (auto-deploys to Netlify)
feat/<name>       ← feature branches → PR → merge to main
```

Always open a PR against `main`. Netlify previews are generated for each PR automatically.

## Test Credentials (local / staging only)

| Field | Value |
|---|---|
| Email | `test@naatupakam.family` |
| Password | `Test123!` |
| Local URL | `http://localhost:8080` |

## License

Private — NaatuPaakam family use only.
