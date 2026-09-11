# Family Vibes — Feature List

> Dev: http://localhost:5177  
> Live: https://one-family.netlify.app  
> Private, invite-only family platform — stories, events, family tree, AI summaries.

---

## Shipped (MVP Release 1 — 2026-09-09)

### 1. Authentication & Registration
- Email + password sign-up (full name, email, password)
- Email + password sign-in; Google OAuth sign-in
- AuthModal with Sign In / Sign Up tabs — pre-selectable, with post-auth redirect
- Avatar in header after sign-in; family badge (❤️ FamilyName) appears
- Sign out via avatar dropdown

### 2. Family onboarding
- **"Start your family space →"** CTA on home hero for logged-out users — opens auth modal in Sign Up mode, redirects to `/family-settings?create=1` after sign-in
- **Empty-family state** — shown when signed in but belongs to no family; CTAs: Create a Family / Join with Invite Code
- **Create Family** — any authenticated user can create a new family; becomes its first admin
- **Family bio** — optional short write-up (admin-edit only); shown on home page below family badge when set
- **Family visibility** (ADR-010) — admin sets via Family Settings → General tab:
  - 🔒 **Private** — family name/bio visible to members only (default)
  - 👥 **Open** — family name/bio visible to any registered user (direct link only)
  - 🌐 **Public** — family name/bio visible to anyone (direct link only)
  - Family tree and member list are **always members-only** regardless of this setting

### 3. Invite system (ADR-004)
- **Group invite link** — any member can copy; visitors join as `role = member` via `/join/:invite_code`
- **Personal invite token** — family admin generates a one-time 7-day token link; copy-paste into WhatsApp; revocable
- **`/join/:code`** route — handles both group and personal invite paths; shows sign-in prompt for unauthenticated visitors
- Rotate group invite code (invalidates old link)

### 4. Family Settings (`/family-settings`)
- **Members tab** — list of all members with role badges and join date
- **Bio tab** — admin edits family bio (saved via `update_family_bio` RPC)
- **Invites tab** (admin only) — group link + copy, generate personal invite tokens, revoke pending tokens

### 5. Role system (ADR-001, ADR-003, ADR-005)
- **Family Admin** — bio edit, invite management, member list, close any event, edit/delete any story
- **Family Member** — write stories, host events, edit family tree, share group invite link
- `isFamilyAdmin` context helper; `[ROLE: ...]` tags on all gated UI elements
- Role shown as badge in Family Settings and Portal

### 6. Portal Admin (`/portal`) — ADR-002
- Accessible only to `is_portal_admin = true` users; redirect otherwise
- **Families tab** — all families with member counts, admin chips, suspend/delete, expand for ID + invite link + creator name + copy button
- **Users tab** — all users, portal admin badge, family admin badges per family, make/remove portal admin, make/remove family admin per family, delete user
- Security-definer RPCs bypass RLS for platform-wide visibility

### 7. Family Stories (Blogs)
- Write long-form posts with multiple content sections
- Upload photos to Supabase Storage
- Tag stories to a specific event (🎉 badge on the card)
- Tabs: All / Published / Drafts; search by title/author/tag
- AI draft generation — title → "✨ Generate with AI" → prose draft
- Edit/Delete gated to author or family admin (`[ROLE: family-admin]`)
- **Visibility picker** (ADR-010) — set per story at publish time:
  - 🔒 **Private** — author only (Drafts tab)
  - ❤️ **Family** — family members only (default published state)
  - 👥 **Open** — any registered user
  - 🌐 **Public** — anyone, no login needed; accessible via `/stories/:id`
- Stories scoped via `story_families` junction table (multi-family ready — ADR-009)

### 8. Events
- Create events with title, location, description; AI description generation
- RSVP invite list: Invited / Going / Pending / Declined per member
- Lifecycle tabs: Upcoming / Ongoing / Past / All; search by title/location
- Close Event — creator or family admin; archived to Past tab
- Live event banner in header (amber strip with event pill)
- **Visibility picker** (ADR-010) — set per event at creation time:
  - ❤️ **Family** — family members only (default)
  - 👥 **Open** — any registered user can read; registered users can RSVP
  - 🌐 **Public** — anyone can read; accessible via `/events/:id`
- Events scoped via `event_families` junction table (multi-family ready — ADR-009)

### 9. Family Tree
- Interactive tree — add child/sibling, edit name/born, expand/collapse
- Auto-saves to Supabase with 800 ms debounce; "Saving…" indicator
- **Logged-out preview** — full sample tree shown; Save/Add Child/Add Sibling buttons prompt sign-in via auth modal; dashed green banner explains it's a sample
- Scoped per family; fallback sample tree when no tree saved

### 10. Home page
- AI Snapshot — auto-generated one-liner (Anthropic Claude via Edge Function)
- Stat cards: Stories / Events / Photos counts
- Family Tree preview (read-only)
- Active Events section with Live badge
- **Logged-out**: "Start your family space →" and "Plan for Event" CTAs only
- **Logged-in**: full hero with Plan for Event, Start a Blog, Build Family Tree
- Family bio strip (if admin has written one)

### 11. Multi-family support
- FamilyMenu switcher — switch families in one click; all data re-scopes instantly
- ❤️ FamilyName badge in header
- `story_families` and `event_families` junction tables allow sharing content across families
- Comments derive family visibility from parent event's `event_families`

### 12. Why Family Vibes (`/why-family-vibes`)
- Competitor comparison (Facebook Groups, WhatsApp, Google Photos, Ancestry, FamilyWall)
- 8 feature pillars, comparison table, who-it's-for, testimonials
- Roadmap: monthly magazine, live event streaming, event games & polls
- Linked from header "Why Family Vibes?" button

---

## Roadmap

| Feature | Status | Notes |
|---|---|---|
| Monthly family magazine (PDF) | In design | Compile stories into print-ready PDF for elders |
| Live event streaming | Coming soon | Stream phone updates during events in real time |
| Event games & polls | On the roadmap | Live polls, trivia, voting during events |
| Story / event templates | R1 | Pre-filled scaffolds for common post types |
| Magazine layout config | R1 | Cover style, font, colour scheme per family |
| Promote / demote members | R1 | Family admin role management |
| Leave family + last-admin guard | R1 | ADR-006 |

---

## Technical stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui (Radix UI) |
| Backend / DB | Supabase (Postgres + RLS + Storage) |
| Auth | Supabase Auth (email/password + Google OAuth) |
| AI | Anthropic Claude via Supabase Edge Functions |
| Hosting | Netlify (auto-deploy from `main`) |
| Testing | Playwright e2e (77 tests), Vitest unit |

---

## Route map

| Path | Page | Auth required |
|---|---|---|
| `/` | Home — hero, AI snapshot, stat cards, events, feature cards | No (preview mode) |
| `/stories` | Family Stories — post grid + detail panel | No (public/open stories visible) |
| `/events` | Events — tabs, detail panel, invite management | No (public/open events visible) |
| `/family-tree` | Interactive family tree editor | No (sample tree preview) |
| `/why-family-vibes` | Business case microsite | No |
| `/join/:code` | Join family via group link or personal token | No (prompts sign-in) |
| `/family-settings` | Family visibility, bio, member list, invite management | Yes (family member) |
| `/portal` | Platform admin dashboard | Yes (portal admin only) |
| `/events/:id` | Public event detail page | No (for open/public events) |
| `/stories/:id` | Public story detail page | No (for open/public stories) |
