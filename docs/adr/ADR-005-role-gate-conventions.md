# ADR-005 — Client-side role gate conventions

**Status:** Accepted  
**Date:** 2026-09-08  
**Updated:** 2026-09-13 — `isFamilyAdmin` no longer includes `isPortalAdmin`  
**Deciders:** Pavan Kumar Bijjala

---

## Context

Without a clear convention, role checks will be scattered across components as ad-hoc string comparisons (`activeFamily?.role === 'admin'`), making it easy to miss a gate or use the wrong condition.

## Decision

### Single source of truth for role checks

Always use context helpers — never raw field comparisons in components:

```ts
// In any component:
const { isFamilyAdmin } = useFamily();   // true only if role='admin' in active family
const { isPortalAdmin } = useAuth();     // true if profiles.is_portal_admin = true
const { session } = useAuth();           // truthy if any user is signed in
```

**`isFamilyAdmin` does NOT include `isPortalAdmin`.** A portal admin visiting a family where they are a plain member sees member UI. Portal-level operations (e.g. rename any family, delete any member) go through `/portal`, not family admin UI. This prevents portal admins from seeing family admin controls they didn't earn via the invite/promote flow.

**Never write in a component:**
```ts
// BAD — fragile, ignores proper role abstraction
activeFamily?.role === 'admin'
profile?.is_admin
profile?.is_portal_admin   // only use directly inside AuthContext itself
```

### Tagging convention — every feature/component must declare its required role

When adding any new UI element that is role-gated, add an inline comment on the gate:

```tsx
{/* [ROLE: family-admin] */}
{isFamilyAdmin && <Button>Rename Family</Button>}

{/* [ROLE: any-member] */}
{session && <Button>Write Story</Button>}

{/* [ROLE: portal-admin] */}
{isPortalAdmin && <Link to="/portal">Portal</Link>}
```

This makes it grep-able (`grep -r '\[ROLE:'`) to audit all role gates across the codebase.

### RLS is the enforcement layer — UI is the UX layer

- Client-side gates (`isFamilyAdmin && ...`) are for UX only — hiding buttons the user shouldn't see.
- Supabase RLS policies are the actual security enforcement — a missing client gate is a UX bug; a missing RLS policy is a security hole.
- Every DB-touching feature must have both layers.

### Checklist for every new feature (added to pre-push review)

Before closing any task that touches access-controlled UI:
- [ ] Minimum role identified and documented with `[ROLE: ...]` comment
- [ ] Client gate uses `isFamilyAdmin` or `isPortalAdmin` helper — not raw field comparison
- [ ] Corresponding RLS policy exists or has been added in this commit's migration
- [ ] Playwright test covers the gated element (visible for the correct role, hidden for others)

### Route protection pattern

Pages restricted to a role must redirect at the top of the component, not rely on hiding the nav link alone:

```tsx
// /portal page
const { isPortalAdmin } = useAuth();
if (!isPortalAdmin) return <Navigate to="/" replace />;
```

```tsx
// Any authenticated-only page
const { session } = useAuth();
if (!session) return <Navigate to="/" replace />;
```

## Consequences

- `FamilyContext` must export `isFamilyAdmin` (one-line addition).
- Code review checklist (CLAUDE.md) updated to verify `[ROLE: ...]` tag on every gated element.
- Existing ungated admin actions (Close Event, Delete Story) must be wrapped in the first commit that formally adopts this ADR.
- Playwright sanity suite extended: each new role-gated feature needs a TC- covering both the allowed and denied cases.
