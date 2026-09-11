# ADR-009 — Stories and events publishable to multiple families

**Status:** Accepted  
**Date:** 2026-09-08  
**Updated:** 2026-09-08 — extended to cover events (same junction table pattern); comments follow parent content's family scope; creator controls family assignment  
**Deciders:** Pavan Kumar Bijjala

---

## Context

Currently both `updates.family_id` and `events.family_id` are single-family columns. A member who belongs to multiple families cannot share a wedding story or a reunion event across both the bride's and groom's family spaces without duplication. Cross-family sharing is a natural use case for both content types.

## Decision

### Schema change — replace single FKs with junction tables

Both `updates.family_id` and `events.family_id` are replaced with junction tables:

```sql
-- Stories → families
create table story_families (
  story_id  uuid not null references updates(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  primary key (story_id, family_id)
);

-- Events → families
create table event_families (
  event_id  uuid not null references events(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  primary key (event_id, family_id)
);
```

Both `updates.family_id` and `events.family_id` are **dropped** in the migration.

The same pattern applies to any future content entity that needs cross-family visibility — add a `<entity>_families` junction table, never add a `family_id` column directly.

### Authorship and publishing rights

**Creator decides — always**
- The story author / event creator is the sole authority on which families the content belongs to.
- Family admins can **remove** content from their family's feed (they can curate, not assign).
- Family admins **cannot add** a story/event to their family that the creator did not include — that is the creator's decision only.
- Portal admins can remove any content from any family (moderation power only, not assignment).

**Stories:**
- Author must be a member of every family they publish to — enforced in `publish_story_to_family(story_id, family_id)` RPC.
- Author can update the family list after publishing (add or remove families) as long as they remain a member of the target families.

**Events:**
- Creator must be a member of every family the event is shared to — enforced in `share_event_to_family(event_id, family_id)` RPC.
- Creator can share to additional families after creation, or remove families.
- An event's live status (Ongoing/Closed) is global — closing it closes it across all families.
- Creator is identified by UUID (`created_by`) — never by name (ADR-008).

### Visibility / RLS

A member sees a story or event in their active family's feed if and only if a row exists in the relevant junction table for `(content_id, active_family_id)` AND the member belongs to `active_family_id`.

```sql
-- RLS SELECT on updates
exists (
  select 1 from story_families sf
  where sf.story_id = updates.id
    and sf.family_id = any(my_family_ids())
)

-- RLS SELECT on events
exists (
  select 1 from event_families ef
  where ef.event_id = events.id
    and ef.family_id = any(my_family_ids())
)
```

### Querying — always join through junction tables

All story and event queries in `client/lib/supabase.ts` must join through the junction table:

```ts
// CORRECT — stories
supabase
  .from('updates')
  .select('*, story_families!inner(family_id)')
  .eq('story_families.family_id', activeFamilyId)

// CORRECT — events
supabase
  .from('events')
  .select('*, event_families!inner(family_id)')
  .eq('event_families.family_id', activeFamilyId)

// FORBIDDEN — columns no longer exist after migration
.eq('family_id', activeFamilyId)
```

### UI — publishing flow

**Stories:** When publishing (not while drafting), the author sees a **"Publish to families"** multi-select:
- Defaults to the active family only.
- Can add other families they are a member of.
- At least one family must be selected to publish.
- Draft stories can have no family selected until publish time.

**Events:** When creating an event, the creator sees a **"Share with families"** multi-select:
- Defaults to the active family only.
- Can add other families they are a member of.
- At least one family must be selected to create.
- Event can be shared to additional families after creation by the creator or a family admin.

### Migration path for existing data

Two breaking migrations, shipped together with the client code change:

```sql
-- Backfill stories
insert into story_families (story_id, family_id)
select id, family_id from updates where family_id is not null;
alter table updates drop column family_id;

-- Backfill events
insert into event_families (event_id, family_id)
select id, family_id from events where family_id is not null;
alter table events drop column family_id;
```

The migration and client code changes (removing `.eq('family_id', ...)`) **must ship in the same deployment** — they are not independently deployable.

### Comments follow the parent content's family scope

Comments on a story or event are visible to **all families that the parent content belongs to** — a comment is not siloed to one family's feed.

```sql
-- RLS SELECT on comments (replaces single family_id check):
-- For story comments:
exists (
  select 1 from story_families sf
  where sf.story_id = comments.story_id   -- if comments reference stories
    and sf.family_id = any(my_family_ids())
)
-- For event comments:
exists (
  select 1 from event_families ef
  where ef.event_id = comments.event_id
    and ef.family_id = any(my_family_ids())
)
```

`comments.family_id` is **dropped** — comments derive their family scope from their parent content, not a stored column.

The practical result: if a wedding event is shared to both the bride's and groom's family spaces, everyone in both families sees the same comments thread on that event.

### Scope — what stays single-family

- `family_trees.family_id` — PK, stays single-family: each family has exactly one tree.
- `family_members`, `family_invitations`, `family_story_templates`, `family_magazine_config` — all inherently single-family; no junction table needed.

### General rule for future entities

Any new content entity (not config/membership) that might be shared across families MUST use a `<entity>_families` junction table from the start. Never add `family_id uuid` directly to a content table.

## Consequences

**Schema (all in one breaking migration):**
- New tables: `story_families`, `event_families`.
- Dropped columns: `updates.family_id`, `events.family_id`, `comments.family_id`.
- RLS on `updates`, `events`, `comments` rewritten to join through junction tables.

**Client (`supabase.ts`):**
- All story queries join through `story_families`.
- All event queries join through `event_families`.
- All comment queries derive family scope from parent content join — no `family_id` filter.
- No `.eq('family_id', ...)` anywhere in story or event queries after this migration.

**UI:**
- Story editor gains "Publish to families" multi-select at publish step.
- Event creation gains "Share with families" multi-select.
- Both default to active family; creator can add other families they belong to.
- Family admins see a "Remove from this family" option on any story/event in their feed (curate, not assign).

**RPCs:**
- `publish_story_to_family(story_id uuid, family_id uuid)` — author-only, validates membership.
- `share_event_to_family(event_id uuid, family_id uuid)` — creator-only, validates membership.
- `remove_story_from_family(story_id uuid, family_id uuid)` — author or family admin.
- `remove_event_from_family(event_id uuid, family_id uuid)` — creator or family admin.

**Tests:**
- Playwright story and event tests updated for new query shape.
- New TC covering: story shared to two families visible in both; comment on that story visible to both.

**Invariants (must never be violated):**
- Creator decides family assignment — admins can only remove, never add on behalf of creator.
- Comment visibility is always derived from parent content — never stored separately.
- All junction table queries use UUIDs only (ADR-008).
