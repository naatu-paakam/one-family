# 🌾 NaatuPaakam — Family News & Updates

A modern, AI-powered family news web app. Admins post updates (with optional photos), Claude AI generates warm descriptions, and the family timeline keeps everyone connected.

**Live:** Deployed on Netlify | **Source:** [github.com/naatu-paakam](https://github.com/naatu-paakam)

---

## Features

| Feature | Details |
|---|---|
| 📅 Timeline | Vertical alternating timeline of family updates |
| 🖼️ Photo updates | Admins upload images; Claude Vision generates captions |
| ✨ AI descriptions | Claude uses last 7 days of events as context |
| 📊 Hashtag stats | Tag cloud on home page; click any tag to filter |
| 📝 Weekly summary | AI-generated summary refreshed on demand |
| 🔐 SSO login | Google + Facebook via Supabase Auth |
| ✏️ Edit after posting | Author or admin can edit any update |
| 🗑️ Delete | Admins can delete updates |

---

## Tech Stack

```
Frontend  : React 18 + Vite + Tailwind CSS
Backend   : Supabase (Auth · PostgreSQL · Storage · Edge Functions)
AI        : Anthropic Claude (claude-sonnet-4-6) — server-side only
Hosting   : Netlify (static build + optional Netlify Functions)
```

---

## Security: Where the Claude API key lives

> **The `ANTHROPIC_API_KEY` is never exposed to the browser.**

Two equivalent deployment options are provided — choose one:

### Option A — Supabase Edge Functions (Recommended)
The key is stored in Supabase's secret store and the Claude call happens inside a Deno edge function running on Supabase's infrastructure.

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy generate-description
supabase functions deploy generate-summary
```

Then update the two fetch URLs in the React code:

| File | Change `/api/generate-*` to |
|---|---|
| `src/components/AdminForm.jsx` | `https://<ref>.supabase.co/functions/v1/generate-description` |
| `src/components/EditModal.jsx` | same |
| `src/components/SummarySection.jsx` | `https://<ref>.supabase.co/functions/v1/generate-summary` |

### Option B — Netlify Functions
The key is stored as a Netlify environment variable (server-side) and the function runs on Netlify's infrastructure. The `/api/*` redirect in `netlify.toml` already routes calls to `/.netlify/functions/*`.

Set in Netlify Dashboard → Site settings → Environment variables:
```
ANTHROPIC_API_KEY=sk-ant-...
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # for generate-summary only
```

---

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/naatu-paakam/<repo-name>.git
cd <repo-name>/naatupakam-family
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Copy **Project URL** and **anon public** key from Settings → API
3. Run `supabase/schema.sql` in the SQL Editor
4. Create storage bucket: Dashboard → Storage → New bucket → `update-images` (public)
5. Enable OAuth providers: Authentication → Providers → Google + Facebook

### 3. Configure OAuth providers in Supabase

**Google:**
1. [Google Cloud Console](https://console.cloud.google.com) → APIs → Credentials → OAuth 2.0 Client
2. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Paste Client ID + Secret into Supabase → Auth → Providers → Google

**Facebook:**
1. [developers.facebook.com](https://developers.facebook.com) → My Apps → New App
2. Facebook Login → Settings → Valid OAuth Redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Paste App ID + Secret into Supabase → Auth → Providers → Facebook

### 4. Set environment variables

```bash
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
# Do NOT put ANTHROPIC_API_KEY here — it goes in Netlify/Supabase secrets only
```

### 5. Run locally

```bash
npm run dev                # React dev server on http://localhost:3000
# or
npm run netlify:dev        # Netlify Dev (also runs functions) on http://localhost:8888
```

---

## Database Schema

```
profiles   — extends auth.users; stores full_name, avatar_url, is_admin
updates    — family posts: title, content, image_url, hashtags[], author_id, ai_generated
summaries  — AI-generated weekly summaries
```

Full schema with RLS policies: [`supabase/schema.sql`](supabase/schema.sql)

---

## Granting Admin Access

After the first user logs in:

```sql
-- In Supabase SQL Editor
UPDATE profiles SET is_admin = true WHERE id = '<paste-user-uuid>';
```

Or use the Supabase Table Editor → profiles → toggle `is_admin`.

Only admins can:
- Post new updates
- Delete any update
- Trigger the AI summary refresh
- Access `/admin` route

Non-admin signed-in users can:
- Edit their own updates after they are posted
- View all updates and details

---

## Netlify Deployment

1. Push repo to [github.com/naatu-paakam](https://github.com/naatu-paakam)
2. Netlify → New site from Git → select repo
3. Build settings (auto-detected from `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Add environment variables (Site settings → Environment):
   ```
   VITE_SUPABASE_URL
   VITE_SUPABASE_ANON_KEY
   ANTHROPIC_API_KEY          # server-side only — safe in Netlify env vars
   SUPABASE_SERVICE_ROLE_KEY  # for generate-summary function
   ```
5. Set the Supabase Auth redirect URL to your Netlify domain:
   Supabase → Auth → URL Configuration → Site URL = `https://your-site.netlify.app`

---

## Project Structure

```
naatupakam-family/
├── src/
│   ├── components/
│   │   ├── AdminForm.jsx       # Image upload + AI generation form
│   │   ├── AuthModal.jsx       # Google / Facebook SSO modal
│   │   ├── EditModal.jsx       # Edit update (with re-generate)
│   │   ├── EventCard.jsx       # Timeline card
│   │   ├── HashtagStats.jsx    # Tag cloud + filter
│   │   ├── Header.jsx          # Top nav + auth menu
│   │   ├── SummarySection.jsx  # AI weekly summary
│   │   └── Timeline.jsx        # Alternating vertical timeline
│   ├── contexts/
│   │   └── AuthContext.jsx     # Session, profile, isAdmin
│   ├── lib/
│   │   └── supabase.js         # All DB/storage helpers
│   ├── pages/
│   │   ├── Admin.jsx           # Admin panel (guarded route)
│   │   ├── EventDetail.jsx     # Full update view + edit/delete
│   │   └── Home.jsx            # Timeline + hashtag stats + summary
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── netlify/
│   └── functions/
│       ├── generate-description.js   # Option B: Netlify Function
│       └── generate-summary.js       # Option B: Netlify Function
├── supabase/
│   ├── schema.sql
│   └── functions/
│       ├── generate-description/index.ts  # Option A: Supabase Edge Function
│       └── generate-summary/index.ts      # Option A: Supabase Edge Function
├── public/
│   └── favicon.svg
├── .env.example
├── netlify.toml
├── package.json
├── tailwind.config.js
└── vite.config.js
```

---

## Roadmap / Future Enhancements

- [ ] Reactions (❤️ 🎉 😂) on updates
- [ ] Push notifications (Web Push API)
- [ ] Email digest via Supabase scheduled functions
- [ ] Multi-language support (Tamil, Telugu, …)
- [ ] Family tree integration
- [ ] Video uploads (Supabase Storage large files)
- [ ] RSVP/events calendar view

---

## Claude AI Model

Default model: **`claude-sonnet-4-6`** (balances quality and cost).

To switch models, set the `CLAUDE_MODEL` env var:
```
CLAUDE_MODEL=claude-opus-4-8   # highest quality
CLAUDE_MODEL=claude-haiku-4-5-20251001  # fastest / lowest cost
```

See [Anthropic model docs](https://docs.anthropic.com/en/docs/about-claude/models) for the latest IDs.

---

## Contributing

1. Branch from `main`
2. Open a PR to `naatu-paakam/<repo>`
3. Tag the admin for review

---

*Built with ❤️ for the family — NaatuPaakam means "village flavour"*
