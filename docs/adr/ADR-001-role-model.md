# ADR-001 — Three-tier role model

**Status:** Accepted  
**Date:** 2026-09-08  
**Deciders:** Pavan Kumar Bijjala

---

## Context

Family Vibes initially shipped with no enforced role model. The DB schema has two partial concepts:
- `profiles.is_admin` — a global boolean with no defined semantics
- `family_members.role` — `'admin' | 'member'` per family, fetched but never acted on in the UI

As the platform grows to multiple families and needs governance, a coherent persona model is required so that every feature knows who can do what.

## Decision

Adopt a **three-tier role model**. Tiers are independent: a user can hold any combination across families.

### Tier 1 — Portal Admin
- Platform-level role. Stored as `profiles.is_portal_admin boolean` (replacing `profiles.is_admin`).
- Can: view all families, suspend/re-activate families, promote other users to portal admin, do everything a family admin can in any family.
- Access: `/portal` dashboard (separate route, not in main nav).
- Assigned: manually by another portal admin via SQL or the `/portal` UI.

### Tier 2 — Family Admin
- Per-family role. Stored as `family_members.role = 'admin'`.
- Can: everything a member can + rename family, manage members (invite by email, promote/demote, remove), configure family settings and templates.
- A family may have multiple admins simultaneously.
- The user who creates a family becomes its first admin automatically.
- Can be a member/admin in other families independently.

### Tier 3 — Family Member
- Per-family role. Stored as `family_members.role = 'member'`.
- Can: write stories, comment, host/manage events, edit the family tree, share the group invite link.
- Default role when joining via invite link.
- Can be a member in multiple families.

### Hierarchy
Portal Admin ⊇ Family Admin ⊇ Family Member — each tier includes everything below it.

## Consequences

- Every new feature must be tagged with the minimum required role (see ADR-005).
- `profiles.is_admin` is renamed to `profiles.is_portal_admin` in the next migration — all references must be updated.
- `AuthContext` exposes `isPortalAdmin: boolean`; `FamilyContext` exposes `isFamilyAdmin: boolean` for the active family.
- No feature may bypass role checks by checking `session` alone.
