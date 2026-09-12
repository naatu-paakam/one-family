# Family Vibes — Claude Code Instructions

## Repo structure

This is the **active** app. The old Vite-only app lives at `../one-family-deprecated/`.

```
client/           # React 18 + TypeScript SPA (Vite)
  pages/          # Index, Blogs (Stories route: /stories), Events, FamilyTree,
                  # WhyFamilyVibes, JoinFamily, FamilySettings, Portal,
                  # PublicEvent, PublicStory, NotFound
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
e2e/              # Playwright test specs (8 files, ~100 tests)
docs/
  adr/            # Architecture Decision Records (ADR-001 to ADR-012)
  releases/       # Release notes: MVP.md (current milestone), R1.md, POC.md
```

## Dev server

```bash
npm install
npm run dev       # http://localhost:5176
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

```bash
npx playwright test                       # run all 9 spec files (~207 tests)
npx playwright test e2e/sanity.spec.ts    # smoke — core pages load (9)
npx playwright test e2e/auth.spec.ts      # sign-in, sign-out, TC-AUTH-* (12)
npx playwright test e2e/mvp.spec.ts       # MVP feature acceptance (16)
npx playwright test e2e/portal.spec.ts    # portal admin routes + gates (16)
npx playwright test e2e/regression.spec.ts# regression guard (39)
npx playwright test e2e/tree.spec.ts      # family tree CRUD + BUG-* (28)
npx playwright test e2e/visibility.spec.ts# ADR-010 visibility tiers (27)
npx playwright test e2e/story-comments.spec.ts # TC-SCOM-* story comments (11)
npx playwright test e2e/e2e-full.spec.ts  # full user journeys (49)
```

> `RESEND_API_KEY` must be set for TC-AUTH-04 (email invite test); it is not required for the rest of the suite.

Sign in with:
- Email: `test@naatupakam.family`
- Password: see `.notes` (gitignored — never commit test credentials)
- URL: `http://localhost:5177`

### Checklist

1. **Home page — family with data (use NaatuPaakam)**
   - AI Snapshot shows real counts: e.g. "1 active event happening now. 5 stories shared by your family. 1 photo captured so far. Family tree is growing."
   - Hero stat cards: Stories = real count, Events = real count, Photos = real count (no "5+" or fake values)
   - Family Tree preview renders the active family's real tree (not the hardcoded Pat & Jordan sample)
   - Events section shows real active events with amber "Live" badge; heading reads "Active Events"
   - Active event pills appear in the header banner
   - Active family name badge (❤️ FamilyName) visible next to logo

2. **Home page — empty family (regression: create a fresh family)**
   - AI Snapshot shows encouraging message: "Your family space is ready! Start by adding a story, planning an event, or building your family tree — every memory begins with a first step. 🌱"
   - Hero stat cards: Stories —, Events —, Photos 0
   - Family Tree preview shows the fallback sample tree (no family tree saved yet)
   - Events section shows empty state: "No active events yet. Plan one for your family!"
   - No live event banner in header
   - Family name badge updates to the new family name immediately

3. **Family isolation — switching families**
   - Switch from NaatuPaakam → Sharma Side: all hero stats, tree, events, and AI Snapshot update to Sharma Side data
   - Switch back to NaatuPaakam: all values restore correctly
   - Stories page only shows posts for the active family
   - Events page only shows events for the active family
   - Family tree page loads the correct family's tree

4. **Header / Auth**
   - "Join Family" button visible when logged out
   - Sign-in modal: email/password + Google OAuth button
   - After sign-in: avatar appears, "Plan for Event" button visible, active family badge appears
   - Active event pills appear below header when events exist for the active family
   - Sign out clears session and removes family badge

5. **Stories page** (`/stories`)
   - Posts load from Supabase scoped to active family (All / Published / Drafts tabs)
   - Visibility picker: 🔒 Private / ❤️ Family / 👥 All users / 🌐 Public — label "Who can see this?"
   - Clicking a card shows detail in right panel; visibility badge on each card
   - Comments: author can enable/disable per story (`comments_enabled`); count badge shown when > 0
   - Edit/delete shown if user is author or family admin; delete uses inline confirm (no browser popup)
   - `/stories/:id` public route — correct ❤️/👥/🌐 banner; sign-in gate for family/open

6. **Events page** (`/events`)
   - Upcoming / Ongoing / Past / All tabs filter correctly for active family
   - Visibility badge (❤️ Family / 👥 Open / 🌐 Public) on event cards and detail panel
   - Detail panel: Modify Event, invite list with RSVP (own invite highlighted), delete invites
   - Add invite: typeahead from family members; no email required
   - Create/Close/Delete event all use inline confirmation panels (no browser popups)
   - `/events/:id` public route — correct ❤️/👥/🌐 banner; sign-in gate for family/open

7. **Family Tree page** (`/family-tree`)
   - Tree loads from `family_tree_nodes` flat table, scoped to active family
   - Sidebar: Save → Add Child/Sibling (in that order); delete uses inline confirm
   - Expand/collapse, edit name/born, add child/sibling work
   - "This is me" flag persists after navigating away and returning (BUG-004 fix)
   - Multiple root nodes: all visible (second root attaches under primary — BUG-005 fix)
   - Switching families loads the new family's tree without page reload

8. **AI generation**
   - Events: enter title + location → "✨ Generate with AI" → prose description fills in
   - Stories: enter title → "✨ Generate with AI" → prose content fills in
   - Both call the `generate-description` Edge Function (requires `ANTHROPIC_API_KEY` secret set)

### Notes
- Google OAuth cannot be automated — test manually
- AI Edge Functions require `ANTHROPIC_API_KEY` set via `supabase secrets set`
- `RESEND_API_KEY` is only needed for TC-AUTH-04; the app runs without it

### Test data isolation

All seed data lives in two **dedicated test families** created at run-start and deleted after:

| Family | Purpose |
|---|---|
| **Test Family A** | Primary — all seed stories, events, tree nodes seeded here |
| **Test Family B** | Secondary — for cross-family visibility and isolation tests |

These are created via `create_family` RPC in `e2e/global-setup.ts` and their UUIDs stored in `.playwright/test-families.json`. Teardown calls `portal_delete_family` (cascade) per family — one call removes everything. No real families (NaatuPaakam, Sharma Side, etc.) are touched by tests.

The `storageState` (`.playwright/auth.json`) pre-selects Test Family A as the active family so all tests start there without any additional sign-in or family-switch steps.

## Pre-push security gate (mandatory)

Before every `git push`, run this grep. It must return **zero real secrets**:

```bash
grep -rn "eyJ\|re_[A-Za-z0-9]\|sk_live" \
  client/ supabase/ public/ \
  --include="*.ts" --include="*.tsx" --include="*.sql" --include="*.json" \
  --exclude-dir=node_modules
```

If any match is a real credential (not a test fixture or placeholder), **do not push**. Remove the secret, rotate it, and update `.notes` or Supabase secrets instead.

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
feat/<name>           ← feature branches
```

> **Current stage: MVP Release 1b — shipped locally; not yet pushed to Netlify.**  
> See `docs/releases/MVP.md` for the current milestone checklist and Definition of Done.  
> Before merging `feat/*` → `main`, all Playwright tests must pass and the pre-push security gate must return zero hits.

---

## Architecture Decision Records (ADRs)

ADRs live in `docs/adr/`. **Read the relevant ADR before implementing any feature that touches roles, auth, families, or invites.** All ADRs are binding — a change that violates one must first update the ADR with explicit sign-off.

| ADR | Scope | Read when… |
|---|---|---|
| [ADR-001](docs/adr/ADR-001-role-model.md) | Three-tier role model | Any auth or access-control work |
| [ADR-002](docs/adr/ADR-002-portal-admin.md) | Portal admin (`/portal`, `is_portal_admin`) | Touching `profiles.is_admin`, portal route, or platform-level admin UI |
| [ADR-003](docs/adr/ADR-003-per-family-roles.md) | Per-family role enforcement | Any feature that shows/hides UI based on family role |
| [ADR-004](docs/adr/ADR-004-invite-system.md) | Invite system | Invite links, join flow, `family_invitations` table |
| [ADR-005](docs/adr/ADR-005-role-gate-conventions.md) | Role gate conventions | **Every feature** — this is the coding standard |
| [ADR-006](docs/adr/ADR-006-multi-family-membership.md) | Multi-family model | Family switching, leaving a family, empty-family state |
| [ADR-007](docs/adr/ADR-007-templates.md) | Template system | Story templates, event templates, magazine layout config |
| [ADR-008](docs/adr/ADR-008-identifier-policy.md) | UUID identifier policy | **Every** feature — no name/email/title as FK, filter, or URL param |
| [ADR-009](docs/adr/ADR-009-multi-family-story-publishing.md) | Multi-family content publishing | Stories, events, comments — junction tables, creator-controls-assignment rule |
| [ADR-010](docs/adr/ADR-010-visibility-tiers.md) | Visibility tiers (family/open/public) | Any feature touching event/story/family visibility, public routes, comments, RSVP |
| [ADR-012](docs/adr/ADR-012-family-tree-scale.md) | Family tree scale | Any tree feature — storage, rendering, search, save logic |

### Pre-push checklist — role-related changes

Before pushing any commit that touches auth, roles, families, invites, or access-controlled UI:

- [ ] **ADR read** — relevant ADR(s) reviewed for this change
- [ ] **Role gate uses helper** — `isFamilyAdmin` or `isPortalAdmin` from context, not raw field comparison
- [ ] **`[ROLE: ...]` tag** — every gated UI element has the inline comment (grep: `grep -r '\[ROLE:'`)
- [ ] **RLS policy** — new DB-touching feature has a corresponding RLS policy (in a migration, not edited inline)
- [ ] **Both layers** — client gate (UX) AND RLS (security) both present
- [ ] **Test coverage** — TC- test for the gated element covering allowed + denied roles
- [ ] **`family_id` filter** — every new Supabase query that returns family-scoped data includes `family_id` filter
- [ ] **Template picker is optional** — members can always start blank; never force a template (ADR-007)
- [ ] **Family bio gate** — edit affordance on bio is wrapped in `{isFamilyAdmin && ...}`; bio section hidden entirely when null (ADR-003)
- [ ] **Invite link path** — individual invite is copy-paste token only; no email sending code (ADR-004)
- [ ] **UUID identifiers** — no name, email, or title used as FK, filter key, or URL param for any entity; run audit grep: `grep -rn "\.eq('name'\|\.eq(\"name\"\|\.eq('email'\|\.eq('title'\|\.eq('full_name'" client/lib/ supabase/ --include="*.ts" --include="*.sql"` → must return 0 hits (ADR-008)
- [ ] **Junction tables** — story and event queries join through `story_families` / `event_families`; no `.eq('family_id',...)` on `updates` or `events` tables (ADR-009)
- [ ] **Creator controls family assignment** — no code path allows a family admin or portal admin to *add* a story/event to a family the creator did not choose; admins can only remove (ADR-009)
- [ ] **Comment scope derived from parent** — no `comments.family_id` filter; comment visibility comes from parent story/event junction table join (ADR-009)
- [ ] **Visibility tiers** — every new query on `events` or `updates` respects the `visibility` column; public routes work without session; open routes require `auth.uid() is not null` (ADR-010)
- [ ] **Family tree + member list always private** — no code path exposes tree or member list to `open` or `public` tier (ADR-010 invariant)
- [ ] **Tree uses flat rows** — no new code writes to `family_trees.tree_data` JSONB; all tree reads/writes go through `family_tree_nodes` table (ADR-012)
- [ ] **Tree collapses by default** — nodes beyond depth 1 start collapsed; no full-tree expansion on load (ADR-012)
