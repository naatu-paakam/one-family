# Family Vibes — MVP Plan

## Stages

| Stage | Description | Status |
|---|---|---|
| **POC** | Basic CRUD, single-family, no roles, no invite UI | ✅ Done |
| **MVP Release 1** | Onboarding, roles, invite system, portal admin | ✅ Shipped 2026-09-09 |
| **MVP Release 2** | Deeper stories, events, family tree (multi-family UI) | 🔜 Next |
| **R1** | Templates, magazine, live streaming, polls | Backlog |

> **Working rule:** No push to `main` / Netlify until MVP Release 2 is ready and all tests pass.

---

## MVP Release 1 — SHIPPED ✅ (2026-09-09)

### M1 — Schema + Auth ✅

| Task | Status |
|---|---|
| Migration: `is_admin` → `is_portal_admin` + RLS update | ✅ |
| Migration: `story_families` junction table, drop `updates.family_id` | ✅ |
| Migration: `event_families` junction table, drop `events.family_id` | ✅ |
| Migration: drop `comments.family_id`; derive from parent event | ✅ |
| Migration: `families.bio` column + `update_family_bio` RPC | ✅ |
| Migration: `family_invitations` table + RPCs (generate, join, rotate) | ✅ |
| Migration: portal admin RPCs (`portal_fetch_*`, delete, set role) | ✅ |
| `AuthContext`: `isPortalAdmin`, `signUpWithEmail`, `openAuthModal(opts?)` | ✅ |
| `FamilyContext`: `isFamilyAdmin` computed helper | ✅ |
| `supabase.ts`: all story/event/comment queries use junction tables | ✅ |

### M2 — Family Home ✅

| Task | Status |
|---|---|
| Sign-up flow (AuthModal with Sign Up tab, redirectTo support) | ✅ |
| "Start your family space →" CTA on home hero for logged-out users | ✅ |
| Empty-family state on home page ("Create a Family" / "Join with Invite Code") | ✅ |
| Family bio strip on home page (admin-edit, hidden when null) | ✅ |
| Group invite link UI (Family Settings → Invites tab, copy button) | ✅ |
| `/join/:code` route (group + personal token, sign-in prompt) | ✅ |
| Personal invite token (admin generates, copy-paste, revocable) | ✅ |
| Member list (Family Settings → Members tab, role badges) | ✅ |
| Family Settings page (`/family-settings`) with 3 tabs | ✅ |
| Portal admin page (`/portal`) — families + users tabs | ✅ |
| "Family Settings" + "Portal Admin" in avatar dropdown (role-gated) | ✅ |
| Family Tree — sample tree preview + sign-in prompt for logged-out | ✅ |

### Tests ✅

| Suite | Count | Status |
|---|---|---|
| `e2e/sanity.spec.ts` | 9 | ✅ |
| `e2e/regression.spec.ts` | 38 | ✅ |
| `e2e/mvp.spec.ts` | 16 | ✅ |
| `e2e/portal.spec.ts` | 16 | ✅ |
| **Total** | **79** | **✅ All passing** |

---

## MVP Release 1b — Visibility tiers — SHIPPED ✅ (2026-09-10)

| Task | Status |
|---|---|
| DB: `visibility` column on `updates`, `events`, `families` + RLS (ADR-010) | ✅ |
| DB: `update_family_visibility` RPC | ✅ |
| Story editor: 4-tier visibility picker (🔒 private / ❤️ family / 👥 open / 🌐 public) | ✅ |
| Drafts tab: driven by `visibility = 'private'` (replaces empty-content heuristic) | ✅ |
| Event creation: 3-tier visibility picker (❤️ family / 👥 open / 🌐 public) | ✅ |
| Family Settings: General tab with family profile visibility control | ✅ |
| `/events/:id` public standalone route | ✅ |
| `/stories/:id` public standalone route | ✅ |
| `e2e/visibility.spec.ts`: 13 new TC-VIS-* tests, all passing | ✅ |

---

## MVP Release 1c — Quality & UX polish — SHIPPED ✅ (2026-09-12)

### Visibility UX
| Task | Status |
|---|---|
| Chip label "to Family" → "Family" across stories and events | ✅ |
| Section label unified to "Who can see this?" (was "Visibility" in stories, "Who can see this event?" in events) | ✅ |
| `/stories/:id` and `/events/:id` banners correctly show ❤️ family / 👥 open / 🌐 public tier | ✅ |

### Events
| Task | Status |
|---|---|
| Create event RLS fix (bare INSERT → link to family → SELECT — same pattern as stories) | ✅ |
| Delete button in Modify Event form (owner or family admin only) | ✅ |
| Event list sourced from `fetchAllEvents()` — prevents orphaned-story bleed across families | ✅ |
| Add invite typeahead from family members; email field removed | ✅ |
| Invited user can update own RSVP status; `invited_user_id` column added | ✅ |
| Organiser/admin can delete individual invites (trash icon) | ✅ |
| Visibility badge on event cards and detail panel | ✅ |
| DB: DELETE RLS policy on events (migration 000004) | ✅ |

### Stories — Comments
| Task | Status |
|---|---|
| `comments_enabled` toggle per story (author-controlled, default off) | ✅ |
| Shared `CommentThread` component (client/components/CommentThread.tsx) for stories + events | ✅ |
| Comment count badge on story cards | ✅ |
| DB: `story_id` nullable on `comments`; `event_id` made nullable; CHECK constraint (migrations 000008, 000009) | ✅ |
| `12` new TC-SCOM-* Playwright tests, all passing | ✅ |

### RBAC hardening
| Task | Status |
|---|---|
| `family_members` INSERT: restricted to portal admin (all joins via security-definer RPC) | ✅ |
| `family_members` SELECT: members can see co-members (was own-row only) | ✅ |
| `family_members` DELETE: family admins can remove members | ✅ |
| `comments` DELETE: family admins can moderate comments in their events | ✅ |
| DB: migration 000006 | ✅ |

### Family Tree
| Task | Status |
|---|---|
| Save row above Add Child/Sibling row in sidebar | ✅ |
| Inline delete confirmation (no browser popup) — same pattern applied to Events and Stories | ✅ |
| `buildTree` handles multiple root nodes — no member silently hidden (BUG-005 fix) | ✅ |
| BUG-001 through BUG-004: all resolved, docs removed | ✅ |
| TC-TREE-B04, B05, B05b new regression tests | ✅ |

### Test infrastructure
| Task | Status |
|---|---|
| `TEST_FAMILY_ID` / `TEST_FAMILY_B_ID` — deterministic test families, all seed data isolated there | ✅ |
| `globalSetup`: creates Test Family A & B + seeds stories/events/tree under them | ✅ |
| `globalTeardown`: `portal_delete_family` RPC cascade-deletes both families (one call, no per-table scripts) | ✅ |
| `setup.ts`: storageState pre-selects Test Family A — no NaatuPaakam pollution | ✅ |
| Orphan "New Post" test stories cleaned from DB; teardown now sweeps them by author_id | ✅ |

---

## MVP Release 2 — TODO 🔜

**Goal:** Deeper multi-family UI for stories, events, and family tree; plus member promote/demote.

| Task | ADR | Priority |
|---|---|---|
| DB: `family_tree_nodes` flat table + RLS + JSONB migration | ADR-012 | High |
| `supabase.ts`: replace `fetchFamilyTree`/`saveFamilyTree` with node-level CRUD | ADR-012 | High |
| Tree UI: collapse-by-default (depth > 1), expand/collapse all controls | ADR-012 | High |
| Tree UI: member search box (filter + highlight + auto-expand path) | ADR-012 | High |
| Story editor: "Publish to families" multi-select at publish step | ADR-009 | High |
| Event creation: "Share with families" multi-select | ADR-009 | High |
| Remove story/event from a family (admin) | ADR-009 | High |
| Close Event gated to creator OR family admin in UI | ADR-005 | High |
| Edit/Delete story gated to author OR family admin in UI | ADR-005 | High |
| Promote / demote members in Family Settings | ADR-003 | Medium |
| Leave family + last-admin guard | ADR-006 | Medium |
| Story / event templates (Phase 1: story templates) | ADR-007 | Low |

### Definition of MVP Release 2 Done

- [ ] Multi-family story publishing UI works end-to-end
- [ ] Multi-family event sharing UI works end-to-end
- [ ] Role gates on Close Event and Edit/Delete story enforced in UI (not just DB)
- [ ] All TC- Playwright tests passing
- [ ] `npm run typecheck` 0 errors
- [ ] CLAUDE.md pre-push checklist verified
- [ ] Manual test: sign up → create family → invite member → share story to two families → both see it

---

## R1 scope (post-MVP)

| Feature | ADR |
|---|---|
| Story / event templates | ADR-007 |
| Monthly family magazine PDF | ADR-007 |
| Magazine layout config | ADR-007 |
| Live event streaming | features.md |
| Event games & polls | features.md |
