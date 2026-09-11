# ADR-008 — Identifier policy: UUIDs for every business entity

**Status:** Accepted  
**Date:** 2026-09-08  
**Deciders:** Pavan Kumar Bijjala

---

## Context

This rule applies universally to **every business entity** in the system — users, families, events, stories, comments, templates, invites, reactions, tree nodes, magazine configs, and any future entity.

Using a human-readable field (name, email, title, slug) as an identifier is a category of bug that compounds over time:
- Names/titles are not unique and change
- Emails change — all references break silently
- Exposing names or emails in URLs leaks PII
- Human-readable fields contain characters that break URL routing, query strings, and SQL
- Deduplication logic built on names is inherently fragile

Every entity in this app has a UUID primary key. That UUID is the **only** valid identifier in code, URLs, DB foreign keys, and API calls.

## Decision

### Rule 1 — UUIDs only in FK relationships and queries

Every foreign key and every `.eq()` / `.filter()` / `.match()` call in `supabase.ts` MUST use a UUID column. This applies to every entity — user, family, event, story, comment, template, invite, reaction, tree, config.

```ts
// CORRECT — always use the .id field
.eq('family_id', activeFamilyId)       // uuid
.eq('author_id', session.user.id)      // uuid
.eq('event_id', event.id)             // uuid
.eq('template_id', template.id)       // uuid
.eq('comment_id', comment.id)         // uuid

// FORBIDDEN — any human-readable field as a filter
.eq('name', 'NaatuPaakam')            // family name
.eq('title', 'Diwali 2026')           // event title
.eq('email', 'user@example.com')      // email
.eq('full_name', displayName)         // person name
```

### Rule 2 — UUIDs only in URLs and route params

Route params and query strings MUST use UUID or a purpose-built opaque code. This applies to every entity.

```
// CORRECT
/join/a1b2c3d4-...           (uuid invite token)
/join/abc12345               (opaque invite_code — short hash, not a name)
/events?id=<uuid>            (uuid)
/stories?id=<uuid>           (uuid)
/templates?id=<uuid>         (uuid)

// FORBIDDEN — any entity identified by its display field
/families/naatu-paakam       (family name slug)
/events/diwali-2026          (event title slug)
/stories/our-summer-trip     (story title slug)
/join?email=user@example.com (email in URL — PII leak)
/profile/priya-m             (person name slug)
```

### Rule 3 — Display vs identifier distinction

Name and email fields are **display data only** — shown in UI, never used to look up, join, or route.

| Field | Allowed use | Forbidden use |
|---|---|---|
| `profiles.full_name` | Display in avatar, posts, comments | FK, filter, URL param |
| `profiles.id` | FK, filter, URL param | Display to user |
| `auth.users.email` | Display in account settings | FK, filter, URL param |
| `families.name` | Display in header badge, lists | FK, filter, URL slug |
| `families.id` | FK, filter, URL param | Display to user |
| `invites.full_name` | Guest display name (event RSVP) | Lookup, deduplication |
| `invites.email` | Optional contact info (display only) | Lookup, FK, filter |
| `families.invite_code` | Join URL path segment (opaque, rotatable) | Display as identity |

### Rule 4 — `invite_code` is an opaque access token, not an identifier

`families.invite_code` (short hash like `abc12345`) is used as a join URL path segment, not as a family identifier. It is:
- **Rotatable** — family admin can regenerate it; old codes stop working. This would be impossible if it were an identifier.
- **Not exposed** in app UI as a label or title.
- **Not stored** as a FK anywhere — it is only used as a one-time lookup key in `join_family_by_code()`.

The family's canonical identifier in all other contexts is `families.id` (uuid).

### Rule 5 — New tables must use UUID PKs

Every new table added in a migration must have:
```sql
id uuid primary key default gen_random_uuid()
```
No serial/integer PKs, no name-based PKs.

### Enforcement — audit grep

Before any push, run:
```bash
grep -rn "\.eq('name'\|\.eq(\"name\"\|\.eq('email'\|\.eq(\"email\"\|\.eq('full_name'" \
  client/lib/ supabase/ --include="*.ts" --include="*.sql"
```
Any hit is a violation. The grep must return zero results (chart library internals excepted — use `--include` to target only app code).

## Existing codebase status (audited 2026-09-08)

- No violations found in `client/lib/supabase.ts` or `supabase/migrations/`.
- `invites.full_name` and `invites.email` are display-only fields; all queries on `invites` use `id`, `event_id`, or `family_id`. ✅
- `join_family_by_code` uses `invite_code` (opaque hash, rotatable) — acceptable under Rule 4. ✅

## Consequences

- New code review checklist item: run the audit grep before every push (added to CLAUDE.md).
- `family_invitations` table (ADR-004) must not include `invited_email` as a lookup column — token uuid is the only identifier. ✅ (already removed per ADR-004 update).
- No "vanity URL" / name-slug routing will be added without a new ADR explicitly overriding this rule.
- Portal admin search (ADR-002) may display name/email in search results but must query by UUID internally.
