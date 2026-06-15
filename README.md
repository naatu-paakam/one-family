# 🌾 NaatuPaakam — Family News & Updates

A modern, AI-powered family news web app. Any family member can post updates with photos, Claude AI generates warm descriptions, and the timeline keeps everyone connected.

**Live:** Deployed on Netlify | **Source:** [github.com/naatu-paakam/one-family](https://github.com/naatu-paakam/one-family)

---

## Features

| Feature | Details |
|---|---|
| 📅 Timeline | Vertical alternating timeline of family updates |
| 🖼️ Photo posts | Any logged-in user can upload images |
| ✨ AI descriptions | Claude Vision generates warm captions using last 7 days as context |
| 📊 Hashtag stats | Tag cloud on home page; click to filter timeline |
| 📝 Weekly summary | AI-generated summary, refreshable by admins |
| 🔐 SSO login | Google + Facebook via Supabase Auth |
| ✏️ Edit own posts | Any user can edit/delete their own posts after publishing |
| 🛡️ Admin controls | Admins can edit or delete any post |

---

## Tech Stack

```
Frontend       React 18 + Vite + Tailwind CSS  (static, hosted on Netlify)
Backend        Supabase — Auth · PostgreSQL · Storage · Edge Functions (Deno)
AI             Anthropic Claude claude-sonnet-4-6 — runs inside Edge Functions only
```

---

## Project Constants (Infrastructure Reference)

| Resource | Value |
|---|---|
| **Supabase project** | `one-family` |
| **Supabase project ref** | `tslvjovdqiaxedrmxdfr` |
| **Supabase URL** | `https://tslvjovdqiaxedrmxdfr.supabase.co` |
| **Supabase region** | `ap-southeast-1` (Singapore) |
| **Storage bucket** | `update-images` (public) |
| **GCP project (Vertex AI)** | `aaadpaq-acn-caledonia` |
| **GCP project (OAuth)** | `naatupaakam` |
| **Vertex AI region** | `us-east5` |
| **Claude model** | `claude-sonnet-4-6` |
| **Google OAuth Client ID** | `846814723380-1dktvcvhqtdk9ujggidc4e3co5ic7kq9.apps.googleusercontent.com` |
| **Google OAuth redirect URI** | `https://tslvjovdqiaxedrmxdfr.supabase.co/auth/v1/callback` |
| **GCP service account** | `pavan-claude-code@aaadpaq-acn-caledonia.iam.gserviceaccount.com` |
| **Test user** | `test@naatupakam.family` / `Test123!` |
| **GitHub org** | `https://github.com/naatu-paakam` |

> **Secrets** (stored in Supabase secrets, never in code):
> `GCP_SERVICE_ACCOUNT_JSON` · `GOOGLE_CLIENT_SECRET`

---

## Security: How Claude AI calls are protected

> **The GCP service account key never touches the browser or Netlify.**

The key is stored in **Supabase's secret store** and only executes inside Deno Edge Functions. The browser sends the public anon key as a bearer token to invoke the function — the GCP credentials are never part of the request or response.

```
Browser ──(anon key)──► Supabase Edge Function ──(GCP service account)──► Vertex AI ──► Claude
                              (Deno, server-side)
```

Set it once:
```bash
supabase secrets set GCP_SERVICE_ACCOUNT_JSON="$(cat ~/.claude/vertex-key.json)"
```

That's it. No Netlify env vars, no server to manage.

---

## Local Development Setup

### 1. Clone

```bash
git clone https://github.com/naatu-paakam/one-family.git
cd one-family
npm install
```

### 2. Create a Supabase project

1. [supabase.com](https://supabase.com) → New Project
2. Copy **Project URL** and **anon public key** from Settings → API
3. Run `supabase/schema.sql` in the SQL Editor
4. Create storage bucket: Storage → New bucket → `update-images` (toggle **Public**)
5. Enable OAuth providers: Authentication → Providers → enable Google + Facebook

### 3. Configure Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → Create OAuth 2.0 Client ID
2. Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Paste Client ID + Secret → Supabase → Auth → Providers → Google → Enable

### 4. Configure Facebook OAuth

1. [developers.facebook.com](https://developers.facebook.com) → My Apps → New App → Consumer
2. Facebook Login → Settings → Valid OAuth Redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Paste App ID + Secret → Supabase → Auth → Providers → Facebook → Enable

### 5. Set environment variables

```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### 6. Deploy Edge Functions and set the Claude secret

```bash
# Install Supabase CLI: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <your-project-ref>

# Store the Claude key as a secret — server-side only, never in .env
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# Optional: override the Claude model (default: claude-sonnet-4-6)
# supabase secrets set CLAUDE_MODEL=claude-opus-4-8

# Deploy both Edge Functions
supabase functions deploy generate-description
supabase functions deploy generate-summary
```

### 7. Run locally

```bash
npm run dev     # http://localhost:3000
```

---

## Netlify Deployment

1. Push repo to [github.com/naatu-paakam](https://github.com/naatu-paakam)
2. Netlify → Add new site → Import from Git → select this repo
3. Build settings are auto-detected from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Add **only these two** environment variables in Netlify → Site configuration → Environment variables:

   ```
   VITE_SUPABASE_URL       https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY  eyJ...
   ```

   > The Claude API key goes in Supabase secrets only — not in Netlify.

5. Set allowed redirect URLs in Supabase → Auth → URL Configuration:
   ```
   Site URL:      https://your-site.netlify.app
   Redirect URLs: https://your-site.netlify.app/**
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

## Permissions

| Action | Visitor | Logged-in user | Admin |
|---|---|---|---|
| View timeline & posts | ✅ | ✅ | ✅ |
| Create a post + upload image | ✗ | ✅ | ✅ |
| Edit / delete **own** post | ✗ | ✅ | ✅ |
| Edit / delete **any** post | ✗ | ✗ | ✅ |
| Refresh AI weekly summary | ✗ | ✗ | ✅ |

Permissions are enforced by **Supabase Row Level Security (RLS)** — database-level policies reject unauthorised operations even if the UI is bypassed.

---

## Granting Admin Access

After the first user logs in via Google or Facebook:

```sql
-- Supabase SQL Editor
UPDATE profiles SET is_admin = true WHERE id = '<paste-user-uuid>';
```

Or use the Table Editor → profiles → toggle `is_admin`.

---

## Edge Functions

Both functions live in `supabase/functions/`:

| Function | Trigger | What it does |
|---|---|---|
| `generate-description` | User clicks "✨ Generate with AI" | Receives title + image URL, fetches last 7 days of posts as context, calls Claude Vision, returns a warm 2–3 sentence description |
| `generate-summary` | Admin clicks "↺ Refresh" | Reads all posts from the last 7 days, calls Claude, returns a weekly newsletter-style summary |

Both functions read `ANTHROPIC_API_KEY` from Supabase secrets at runtime — the key never leaves Supabase's infrastructure.

---

## Project Structure

```
one-family/
├── src/
│   ├── components/
│   │   ├── AdminForm.jsx       # Post form with image upload + AI generation
│   │   ├── AuthModal.jsx       # Google / Facebook SSO modal
│   │   ├── EditModal.jsx       # Edit post (with re-generate)
│   │   ├── ErrorBoundary.jsx   # Catches render errors gracefully
│   │   ├── EventCard.jsx       # Timeline card
│   │   ├── HashtagStats.jsx    # Tag cloud + filter
│   │   ├── Header.jsx          # Top nav + auth menu
│   │   ├── SummarySection.jsx  # AI weekly summary (admin refresh)
│   │   └── Timeline.jsx        # Alternating vertical timeline
│   ├── contexts/
│   │   └── AuthContext.jsx     # Session, profile, isAdmin
│   ├── lib/
│   │   └── supabase.js         # DB/storage helpers + callEdgeFunction()
│   ├── pages/
│   │   ├── Admin.jsx           # Post + manage page (any logged-in user)
│   │   ├── EventDetail.jsx     # Full post view + edit/delete
│   │   └── Home.jsx            # Timeline + hashtag stats + summary
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── supabase/
│   ├── schema.sql
│   └── functions/
│       ├── generate-description/index.ts   # Claude Vision description generator
│       └── generate-summary/index.ts       # Claude weekly summary generator
├── public/favicon.svg
├── .env.example
├── netlify.toml
├── package.json
├── tailwind.config.js
└── vite.config.js
```

---

## Claude Model

Default: **`claude-sonnet-4-6`** (fast, high quality, cost-effective).

To upgrade:
```bash
supabase secrets set CLAUDE_MODEL=claude-opus-4-8
```

See [Anthropic model docs](https://docs.anthropic.com/en/docs/about-claude/models) for the latest model IDs.

---

## Roadmap

- [ ] Reactions (❤️ 🎉 😂) on posts
- [ ] Web Push notifications
- [ ] Email digest via scheduled Edge Function
- [ ] Video uploads
- [ ] Multi-language support (Tamil, Telugu, …)
- [ ] Events / RSVP calendar view

---

*Built with ❤️ for the family — NaatuPaakam means "village flavour"*
