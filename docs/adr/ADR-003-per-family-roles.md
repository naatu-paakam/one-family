# ADR-003 — Per-family role storage and enforcement

**Status:** Accepted  
**Date:** 2026-09-08  
**Updated:** 2026-09-08 — added family bio as admin-only field  
**Deciders:** Pavan Kumar Bijjala

---

## Context

`family_members.role` exists in the DB and is fetched client-side (carried on the `Family` object as `activeFamily.role`), but no component reads it to gate any UI or action. This means family admins and members currently see identical UIs.

## Decision

### Storage (no schema change needed)
`family_members.role text NOT NULL default 'member'` with values `'admin' | 'member'` is the source of truth. This is already correct.

### Context helpers
`FamilyContext` must expose two computed booleans derived from `activeFamily`:
```ts
isFamilyAdmin: boolean   // activeFamily?.role === 'admin' || isPortalAdmin
```
`AuthContext` exposes:
```ts
isPortalAdmin: boolean   // profile?.is_portal_admin === true
```

Components must use these helpers — never raw string comparisons scattered across files.

### DB-level enforcement (RLS — already partially done, must be completed)

| Table | Rule |
|---|---|
| `families` | UPDATE only by `family_members.role = 'admin'` for that family — **exists** |
| `family_members` | INSERT own row only — **exists**; UPDATE role only by family admin — **missing, must add** |
| `updates` (stories) | INSERT by any family member; DELETE/UPDATE by author OR family admin OR portal admin |
| `events` | INSERT by any family member; UPDATE/DELETE by creator OR family admin OR portal admin |
| `comments` | INSERT by any family member; DELETE by author OR family admin |

### UI gates (client-side, non-exhaustive — add to this list as features are built)

| Action | Required role |
|---|---|
| Family settings / rename | Family Admin |
| Invite by email | Family Admin |
| Share group invite link | Family Member (any) |
| Promote/demote a member | Family Admin |
| Remove a member | Family Admin |
| Create event | Family Member |
| Close event | Event creator OR Family Admin |
| Edit any story | Story author OR Family Admin |
| Delete any story | Story author OR Family Admin |
| Write / edit family bio | Family Admin (read by all members) |

### Multiple admins
A family may have any number of admins. There is no "owner" distinction in the DB — the `created_by` column on `families` is informational only and confers no extra rights.

### Family bio / about
- `families` table gains a `bio text` column (nullable — optional field) via migration.
- Free-form short write-up about the family — who we are, founding year, motto, etc.
- Displayed on the home page hero section below the family name badge, visible to all members.
- Edit button (inline pencil icon next to the bio) only visible to `isFamilyAdmin`.
- Saved via an `update_family_bio(family_id, bio)` RPC (only callable by family admin — enforced in RLS).
- If `bio` is null/empty, the section is hidden entirely — no placeholder shown to members.

## Consequences

- Every new component that shows an admin-only action must import `isFamilyAdmin` from `FamilyContext`, not implement its own check.
- One migration needed: add RLS policy allowing family admins to UPDATE `family_members.role` for rows in their family.
- `FamilyContext` refactor: add `isFamilyAdmin` computed value (small change).
- All existing admin-only UI (currently ungated) must be wrapped in `{isFamilyAdmin && ...}` guards in the same commit that adds the feature.
