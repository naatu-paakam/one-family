# Family Vibes — Claude Code Instructions

## Repo structure

This is the **active** app. The old Vite-only app lives at `../one-family-deprecated/`.

```
client/           # React 18 + TypeScript SPA (Vite)
  pages/          # Index, Blogs, Events, FamilyTree
  components/
    layout/       # SiteHeader (auth + events), SiteFooter
    ui/           # 30+ shadcn/Radix UI components
  contexts/       # AuthContext, EventContext (Supabase-backed)
  lib/
    supabase.ts   # All Supabase queries
server/           # Express (dev only; Supabase replaces it in prod)
supabase/
  schema.sql      # DB schema + RLS
  functions/      # Edge functions: generate-description, generate-summary
netlify.toml      # Deploys dist/spa as static SPA
```

## Dev server

```bash
npm run dev       # http://localhost:8080
npm run build     # production build → dist/spa/
```

## Environment variables

Copy `.env` — it contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.  
Set the same two vars in Netlify → Site settings → Environment variables for production.

## After every development change — run Playwright tests

Run against `http://localhost:8080`. Sign in with:
- Email: `test@naatupakam.family`
- Password: `Test123!`

### Features to verify after each change

1. **Home page**
   - Loads without errors
   - Shows real recent posts from Supabase (not sample data)
   - Active events appear as amber badges in the hero stats
   - Feature cards link to /blogs, /events, /family-tree

2. **Header / Auth**
   - "Sign In" button visible when logged out
   - Sign-in modal: email/password + Google OAuth button
   - After sign-in: avatar, "Create Event" button, "New Post" button visible
   - Active event pills appear below header when events exist
   - Sign out clears session

3. **Blogs page** (`/blogs`)
   - All posts load from Supabase (no sample data)
   - Clicking a post card shows detail in right panel
   - Event badge (🎉 EventName) shown on event-linked posts
   - When signed in: "+" FAB button visible, "My Posts" tab appears
   - Create post: title + hashtags required, image optional, AI generate button works
   - Edit/delete only shown if user is author or admin

4. **Events page** (`/events`)
   - Active tab shows open events; Past tab shows closed events
   - Event card shows post count and timestamps
   - Detail panel lists posts linked to the event
   - "Close Event" button visible only for active events the user created
   - Create event via "+" FAB (logged in only)

5. **Family Tree page** (`/family-tree`)
   - Tree renders (sample data, not yet Supabase-backed)
   - Expand/collapse nodes works
   - Edit name/born, add child/sibling works in-memory

6. **Create Event flow**
   - Click "Create Event" in header
   - Fill name, submit
   - Amber pill appears in header banner
   - Go to Blogs → create post → event selector appears → attach post to event
   - Go to Events page → Active tab shows the event → post count = 1
   - Close the event → pill disappears from header

7. **AI description generation**
   - On Blogs create form: enter title, click "Generate with AI"
   - Spinner shows, then prose description fills in (no markdown)

### Test credentials
| Field | Value |
|---|---|
| Email | `test@naatupakam.family` |
| Password | `Test123!` |
| Local URL | `http://localhost:8080` |

### Notes
- Google OAuth cannot be automated — test manually
- Family Tree data is still in-memory sample data (Supabase table not yet added)
- AI edge functions require `CLAUDE_API_KEY` / GCP service account set in Supabase secrets

## Deploy to Netlify

1. Push to GitHub (main branch)
2. Netlify auto-builds: `npm run build:client` → publishes `dist/spa`
3. Set env vars in Netlify UI:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. All routes redirect to `index.html` (SPA mode, configured in netlify.toml)
