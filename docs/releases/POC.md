# Family Vibes — POC (archived baseline)

**Status:** Complete — superseded by MVP Release 1 (2026-09-09).

This document is a frozen snapshot of the POC state, kept for reference.

---

## What was shipped in POC

| Area | State |
|---|---|
| Auth | Sign-in only (email + Google OAuth). No custom sign-up page. |
| Home | AI snapshot, stat cards, family tree preview, active events section, feature cards. |
| Stories | CRUD, All/Published/Drafts tabs, AI draft, photo upload, event linking. Single-family (`updates.family_id`). |
| Events | CRUD, tabs, RSVP invite list, AI description, close event, live header banner. Single-family (`events.family_id`). |
| Family Tree | Collaborative editor, auto-save, family-scoped, add child/sibling. Bare text when logged out. |
| Multi-family | FamilyMenu switcher, activeFamily context, family badge. |
| Why Family Vibes | Microsite at `/why-family-vibes` — pillars, comparison, roadmap. |
| Tests | 9 Playwright sanity tests (TC-01–TC-09). |
| Docs | ADRs 001–009, features.md, user-guide.md, .notes. |

## POC schema (archived)

- `profiles.is_admin` boolean (since renamed to `is_portal_admin`)
- `updates.family_id` single FK (replaced by `story_families` junction table)
- `events.family_id` single FK (replaced by `event_families` junction table)
- `comments.family_id` stored column (dropped; visibility derived from parent event)
- `family_members.role` existed but was unused in the UI
- No `families.bio`, `families.suspended_at`, `family_invitations` table

## What was missing (all closed in MVP R1)

- Role enforcement in UI (`isFamilyAdmin`, `isPortalAdmin`)
- Sign-up / registration flow
- Invite link UI (group link, personal token, `/join/:code` route)
- Family bio
- Member list view
- Portal admin page
- Family Settings page
- Multi-family story/event sharing UI
- Sample tree preview for logged-out users
