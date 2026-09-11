# ADR-006 — Multi-family membership model

**Status:** Accepted  
**Date:** 2026-09-08  
**Deciders:** Pavan Kumar Bijjala

---

## Context

A user can belong to multiple families (nuclear family, in-laws, extended network). They can hold different roles in each family (admin in one, member in another). The app already supports this at the DB level but the UX implications need to be explicit.

## Decision

### Data model (no change — already correct)
```
family_members(family_id, user_id, role)   unique(family_id, user_id)
```
A user can have any number of rows — one per family they belong to. Role is per-family.

### Active family concept
- At any point the user has exactly one **active family** — the one all pages are scoped to.
- Stored in `FamilyContext` as `activeFamilyId` (persisted in localStorage so it survives refresh).
- Switching families via `FamilyMenu` instantly re-scopes all data (stories, events, tree, AI snapshot).

### Role is per-family, not global
- Being an admin in Family A gives no elevated access in Family B.
- `isFamilyAdmin` is always computed from `activeFamily.role` — it changes when you switch families.
- Exception: `isPortalAdmin` is global and applies across all families.

### Leaving a family
- Any member can leave a family (DELETE their own `family_members` row).
- The last admin of a family cannot leave unless they first promote another member to admin or the family is suspended by a portal admin.
- If a user leaves all families, they land on a "Join or create a family" empty state on the home page.

### Family creation
- Any authenticated user can create a new family — they become its first admin.
- Creating a family does not remove them from other families.
- No limit on how many families a user can create or join (may add a soft limit later via portal admin config).

### Data isolation guarantee
- All Supabase queries that return family-scoped data (stories, events, tree, storage) MUST include a `family_id = activeFamilyId` filter.
- The `my_family_ids()` security-definer function enforces this at the RLS layer.
- No query may return rows from families the user does not belong to — even for portal admins (portal admin queries use service-role or a separate RLS bypass function).

### UI — FamilyMenu behaviour
- Shows all families the user belongs to, with their role badge (Admin / Member).
- Shows a "Create new family" option at the bottom.
- Shows a "Copy invite link" shortcut for the active family.
- Portal admins see a "Portal" link in the avatar dropdown (not in FamilyMenu).

## Consequences

- `FamilyContext.fetchMyFamilies()` already queries correctly — no change needed.
- "Leave family" action needs a new RPC + UI (confirm dialog, last-admin guard).
- Home page empty state (no families) needs a dedicated component.
- `isFamilyAdmin` recomputes on every family switch — no caching risk.
- All new DB queries added to `supabase.ts` must include `family_id` filter — reviewer checklist item.
