# ADR-002 — Portal admin implementation

**Status:** Accepted  
**Date:** 2026-09-08  
**Deciders:** Pavan Kumar Bijjala

---

## Context

The platform needs a super-admin persona (portal admin) that operates across all families — similar to the `portal_admin` role in the jsdaycare project. The existing `profiles.is_admin` boolean is ambiguous (some RLS policies treat it as "can edit anyone's posts") and must be clarified.

## Decision

### DB
- Rename `profiles.is_admin` → `profiles.is_portal_admin` via a new forward-only migration.
- Update all RLS policies that referenced `is_admin` to reference `is_portal_admin`.
- No new table needed — the boolean on `profiles` is sufficient.

### Assignment
- First portal admin: set manually via Supabase SQL dashboard (`UPDATE profiles SET is_portal_admin = true WHERE id = '<uuid>'`).
- Subsequent portal admins: promoted via the `/portal` UI by an existing portal admin.

### Route
- `/portal` — standalone page, not rendered inside the main family layout.
- Link only appears in the avatar dropdown when `isPortalAdmin === true`.
- Portal admins still belong to families as members/admins — the portal view is additive.

### Portal dashboard capabilities (phased)
**Phase 1 (initial build):**
- List all families (name, member count, created date, status)
- Suspend / re-activate a family (adds `status` column to `families`)
- Promote any user to portal admin

**Phase 2:**
- Usage metrics per family (story count, event count, last active)
- Bulk invite management

### Security
- The `/portal` route must check `isPortalAdmin` on every render and redirect to `/` if false.
- RLS policies must not be the only gate — client-side checks are required for UX, RLS is the final enforcement layer.

## Consequences

- One migration required: rename column + update RLS.
- `AuthContext` must be updated to expose `isPortalAdmin` (replacing `isAdmin`).
- Any existing code checking `isAdmin` must be updated to `isPortalAdmin`.
- Portal admin feature ships after core family admin role gates are wired (ADR-003).
