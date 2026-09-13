# Family Vibes — Feature List

> Dev: http://localhost:5177  
> Live: https://one-family.netlify.app  
> Private, invite-only family platform — stories, events, family tree, AI summaries.

---

## Shipped (MVP Release 1c — 2026-09-13)

### 1. Authentication & Registration
- Email + password sign-up (full name, email, password)
- Email + password sign-in; Google OAuth sign-in
- AuthModal with Sign In / Sign Up tabs — pre-selectable, with post-auth redirect
- Avatar in header after sign-in; family badge (❤️ FamilyName) appears
- Sign out via avatar dropdown

### 2. Family onboarding (ADR-006)
- **"Start your family space →"** CTA on home hero for logged-out users
- **Empty-family state** — signed in but belongs to no family; shows "You're all set!" with Create / Join CTAs
- Stories, Events, and Family Tree pages redirect to home when no family exists
- **Create Family** — any authenticated user can create a new family; becomes its first admin
- **Family bio** — optional short write-up (admin-edit only); shown on home page below family badge
- **Family visibility** (ADR-010) — admin controls via Family Settings → General

### 3. Invite system (ADR-004)
- **Group invite link** — family admin copies via 🔗 icon in My Families panel
- **Group invite code** — family admin copies via 📋 icon in My Families panel
- **Personal invite token** — one-time 7-day link; admin generates from Family Settings → Invites
- **`/join/:code`** route — two-section design (invite card always visible; sign-in / joining / success / error section transitions without page replacement or flicker)
- Rotate group invite code (invalidates old link)

### 4. My Families panel (header hamburger)
- Lists all families with role badge; active family highlighted
- **Admin families**: 📋 copy code · 🔗 copy link icons
- **Member families**: 🗑 leave icon with inline confirmation (admins cannot self-remove)
- Create a new family / Join another family — appear directly below the list (not pinned to bottom)

### 5. Family Settings (`/family-settings`) — admin only
- **General tab** — family profile visibility (private/open/public)
- **Members tab** — list with role badges; 🗑 remove icon (admin only, not on own row) with inline confirmation; admin cannot remove themselves
- **Bio tab** — admin edits bio; shown on home page
- **Invites tab** — group link + copy/rotate; personal one-time tokens + revoke

### 6. Profile dropdown (avatar)
Structured in two groups with separator:
- **New Story** → `/stories?new=1` (auto-opens creation form)
- **Plan for Event** → `/events?create=1` (auto-opens create form)
- ─
- **View Stories** · **View Events** · **View Family Tree**
- ─
- **Family Settings** (admin only) · **Portal Admin** (portal admin only) · **Sign Out**

### 7. Role system (ADR-001, ADR-003, ADR-005)
- **Family Admin** — bio edit, invite management, remove members, close any event, edit/delete any story
- **Family Member** — write stories, host events, edit family tree, share group invite link, leave family
- `isFamilyAdmin` reflects role in active family only — portal admin does NOT inherit family admin UI
- `[ROLE: ...]` tags on all gated UI elements; RLS on every table

### 8. RBAC hardening (migration 000006)
- `family_members` INSERT: restricted to portal admin (all joins via security-definer RPCs)
- `family_members` SELECT: members see all co-members in their families
- `family_members` DELETE: self-leave OR family admin removes OR portal admin removes
- `comments` DELETE: author or family admin
- `is_family_admin()` and `is_portal_admin()` security-definer helpers used in RLS to prevent infinite recursion

### 9. Portal Admin (`/portal`) — ADR-002
- Accessible only to `is_portal_admin = true` users
- **Families tab** — all families; delete; expand for ID + invite link
- **Users tab** — all real users (E2E test accounts `e2e-*` filtered out); email shown; portal admin promote/demote; family admin management; delete user

### 10. Family Stories
- Write long-form posts with photos; tag to a specific event
- Tabs: All / Published / Drafts; search by title/author/tag
- AI draft generation via ✨ Generate with AI
- Edit/Delete gated to author or family admin; delete uses inline confirm
- **Visibility** (ADR-010): 🔒 Private · ❤️ Family · 👥 Open · 🌐 Public
- **Comments** per story — author toggles on/off (default off); comment count badge on cards; full thread with replies, reactions, photo attachments
- `/stories/:id` public route with correct visibility banner (❤️/👥/🌐)

### 11. Events
- Create, modify, delete events; AI description generation
- Modify: title, location, description, visibility — all editable after creation
- **Visibility** (ADR-010): ❤️ Family · 👥 All users · 🌐 Public; badge on cards and detail
- Invite list: typeahead from family members (no email required); RSVP by invited user (highlighted row); organiser can delete invites
- Close Event / Delete Event — both use inline confirm panels
- `/events/:id` public route with correct visibility banner
- All destructive actions use inline confirmation (no browser popups)

### 12. Family Tree (ADR-012)
- Flat `family_tree_nodes` table (no JSONB blob)
- Sidebar: Save row (top) → Add Child / Add Sibling (below); delete uses inline confirm
- "This is me" flag persists after navigating away and returning (BUG-004 fix)
- Multiple root nodes: all visible in canvas (BUG-005 fix)
- Expand/collapse all controls; per-node chevron
- Member search highlights matched nodes

### 13. Inline confirmation dialogs (no browser popups)
Replacing all `window.confirm()` calls across:
- Delete Event · Close Event · Delete Post · Delete family tree node · Remove family member · Leave family

### 14. Home page
- AI Snapshot; stat cards; tree preview; active events; family bio
- **Logged-out**: "Start your family space →" + "Plan for Event" CTAs
- **Logged-in**: Plan for Event · Start a Story · Build Family Tree
- "Start a Blog" renamed to "Start a Story"
- **No-family redirect**: Stories/Events/FamilyTree pages redirect to home for no-family users

### 15. Navigation / UX
- "Family Vibes" logo text: `whitespace-nowrap` — stays one line at 320px mobile
- "Plan for Event" removed from header (redundant with dropdown + home page CTA)
- "New Post" → "New Story" throughout UI and dropdown
- Visibility labels unified to "Who can see this?" across stories and events
- Chip label "to Family" → "Family"

### 16. Test infrastructure
- Deterministic **Test Family A & B** created per suite run via `create_family` RPC
- UUIDs persisted to `.playwright/test-families.json`; teardown cascade-deletes via `portal_delete_family`
- E2E test users (`e2e-reg-*`) swept from DB in teardown via `portal_fetch_e2e_user_ids` RPC
- storageState pre-selects Test Family A — no NaatuPaakam pollution

---

## Roadmap

| Feature | Status | Notes |
|---|---|---|
| Monthly family magazine (PDF) | In design | Compile stories into print-ready PDF for elders |
| Live event streaming | Coming soon | Stream phone updates during events in real time |
| Event games & polls | On the roadmap | Live polls, trivia, voting during events |
| Story / event templates | R1 | Pre-filled scaffolds for common post types |
| Magazine layout config | R1 | Cover style, font, colour scheme per family |
| Promote / demote members | R1 | Family admin role management in Settings |

---

## Technical stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui (Radix UI) |
| Backend / DB | Supabase (Postgres + RLS + Storage + Edge Functions) |
| Auth | Supabase Auth (email/password + Google OAuth) |
| AI | Anthropic Claude via Supabase Edge Functions |
| Hosting | Netlify (auto-deploy from `main`) |
| Testing | Playwright e2e (~220 tests across 9 spec files) |

---

## Route map

| Path | Page | Auth required |
|---|---|---|
| `/` | Home — hero, AI snapshot, stat cards, events, feature cards | No (preview mode) |
| `/stories` | Family Stories — post grid + detail panel | No (public/open stories visible; redirect to `/` if signed-in + no family) |
| `/events` | Events — tabs, detail panel, invite management | No (public/open events visible; redirect to `/` if signed-in + no family) |
| `/family-tree` | Interactive family tree editor | No (sample tree preview; redirect to `/` if signed-in + no family) |
| `/why-family-vibes` | Business case microsite | No |
| `/join/:code` | Join family — two-section invite page | No (sign-in/sign-up shown in section 2) |
| `/family-settings` | Family visibility, bio, members, invite management | Yes (family member) |
| `/portal` | Platform admin dashboard | Yes (portal admin only) |
| `/events/:id` | Public event detail page | No (for open/public events) |
| `/stories/:id` | Public story detail page | No (for open/public stories) |
