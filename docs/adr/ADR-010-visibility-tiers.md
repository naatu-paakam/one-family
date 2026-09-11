# ADR-010 — Visibility tiers for families, events, and stories

**Status:** Accepted  
**Date:** 2026-09-10  
**Updated:** 2026-09-10 — added `private` tier to story visibility (author-only, replaces draft heuristic)  
**Deciders:** Pavan Kumar Bijjala  
**Supersedes:** ADR-004 clause: "Public family discovery — families are not searchable or listed anywhere publicly" and "Open registration without a link"

---

## Context

The current system is fully invite-only and private. All content is restricted to family members via `my_family_ids()` in RLS. Use cases have emerged where:

- A family wants to share a specific event (e.g. Diwali, a reunion) publicly so non-members and non-registered users can see it and RSVP.
- An author wants to share a story (e.g. a heritage piece, a monthly recap) with people outside the family.
- A family admin wants the family's identity (name, bio) to be visible to people outside the family.

Content visibility is **independent of family visibility** — a private family can have public events and stories, and a public family can have members-only content.

Sensitive data (family tree, member list, contact info, birth years) is **always private** regardless of any visibility setting.

---

## Decision

### Visibility tiers

Events and families use three tiers. Stories use four (with `private` as the author-only tier).

| Tier | Label | Who can read | Applies to |
|---|---|---|---|
| `private` | Author only | Only the story author | Stories only |
| `family` | Members only | Family members via `my_family_ids()` | Stories, Events, Families |
| `open` | Registered users | Any authenticated user (any family) | Stories, Events, Families |
| `public` | Anyone | Unauthenticated visitors included | Stories, Events, Families |

---

### Family visibility (`families.visibility`)

Controlled by **family admin**. Applies only to the family's **profile** — its name and bio page.

- `private` (default) — family name and bio visible to members only
- `open` — family name and bio visible to any registered user (direct link only; not indexed)
- `public` — family name and bio visible to anyone (direct link only; not indexed)

**Family visibility does NOT cascade to content.** A private family can have public events/stories. A public family can have members-only content. They are independent axes.

**Always private regardless of family visibility:**
- Family tree (names, birth years, relationships)
- Member list (who belongs to the family)
- Family invitations and invite codes
- Family templates and config

---

### Event visibility (`events.visibility`)

Controlled by the **event creator** at creation time, editable afterwards.

- `family` (default) — only family members see the event
- `open` — any registered user can read the event (title, description, location, posts)
- `public` — anyone can read the event including unauthenticated visitors

**What "public event" means precisely:**
- The event's title, description, location, and creator name are readable by anyone
- Event posts/updates within the event are readable by anyone
- The family name is NOT exposed on public events (content stands alone)
- Comments: **registered users only** — no anonymous comments regardless of event visibility
- RSVP: **registered users only** — any registered user (not just family members) can RSVP to an `open` or `public` event
- Family members still manage the event (Close, Modify, add invites) — unchanged

---

### Story visibility (`updates.visibility`)

Controlled by the **story author** at any time (draft → published → shared). Four levels ordered from most to least restrictive:

- `private` — only the author can read or edit it. Equivalent to an unpublished draft. Not visible to family members.
- `family` (default published state) — only family members of the publishing family see it
- `open` — any registered user can read it
- `public` — anyone can read it including unauthenticated visitors

**Replaces the draft heuristic:** The current system infers draft status from empty content (`content?.trim() ? "published" : "draft"`). The explicit `visibility = 'private'` replaces this:
- The **Drafts** tab shows `visibility = 'private'` stories
- The **Published** tab shows `family | open | public` stories
- **Migration:** existing stories with empty content are backfilled to `visibility = 'private'`; stories with content are backfilled to `visibility = 'family'`

**What "public story" means precisely:**
- Title, content, photos, and author name are readable by anyone
- The family association (which family published it) is NOT exposed publicly
- Comments: **registered users only** — no anonymous comments
- Edit/Delete: author or family admin only — unchanged

**Transition path:** `private → family` is "publish"; `family → private` is "unpublish". Upgrading to `open`/`public` is explicit sharing. Author can move in any direction at any time.

---

### Comments

- **Insert**: any registered user (`auth.uid() is not null`) — if they can read the parent event/story
- **Read**: any registered user who can read the parent content
- No anonymous comments ever — applies to `family`, `open`, and `public` content alike

---

### RSVP on events

- `family` events: family members only (current behaviour)
- `open` or `public` events: any registered user can RSVP — they do not need to join the family
- Non-registered visitors can view a public event but cannot RSVP without registering

---

### Discoverability

- **No public index** by default — public/open content is accessible via direct link only
- Public events and stories are not listed on any landing page or search result
- Portal admin may introduce a curated public index in a future release (separate ADR)
- Family profile pages for `open`/`public` families accessible via direct URL only

---

## Schema changes

```sql
-- Family profile visibility (admin-controlled)
alter table families add column visibility text not null default 'private'
  check (visibility in ('private', 'open', 'public'));

-- Event visibility (creator-controlled)
alter table events add column visibility text not null default 'family'
  check (visibility in ('family', 'open', 'public'));

-- Story visibility (author-controlled) — 4-level hierarchy
alter table updates add column visibility text not null default 'private'
  check (visibility in ('private', 'family', 'open', 'public'));

-- Backfill migration (run after adding column):
-- Stories with content → 'family' (published); without content → 'private' (draft)
update updates set visibility = case
  when content is not null and trim(content) <> '' then 'family'
  else 'private'
end;
```

---

## RLS policy changes

### `updates` (stories)
Replace the current "readable via story_families" policy:
```sql
create policy "Stories readable by visibility tier"
  on updates for select using (
    -- private: author only
    (visibility = 'private' and author_id = auth.uid())
    -- family: family members only
    or (visibility = 'family' and exists (
      select 1 from story_families sf
      where sf.story_id = updates.id
        and sf.family_id in (select public.my_family_ids())
    ))
    -- open: any registered user
    or (visibility = 'open' and auth.uid() is not null)
    -- public: anyone
    or visibility = 'public'
  );
```

### `events`
Replace the current "readable via event_families" policy:
```sql
create policy "Events readable by visibility tier"
  on events for select using (
    visibility = 'public'
    or (visibility = 'open' and auth.uid() is not null)
    or (visibility = 'family' and exists (
      select 1 from event_families ef
      where ef.event_id = events.id
        and ef.family_id in (select public.my_family_ids())
    ))
  );
```

### `comments`
Readable if parent event is readable AND user is registered:
```sql
create policy "Comments readable by registered users on visible events"
  on comments for select using (
    auth.uid() is not null
    and exists (
      select 1 from events e
      where e.id = comments.event_id
        and (
          e.visibility = 'public'
          or (e.visibility = 'open')
          or (e.visibility = 'family' and exists (
            select 1 from event_families ef
            where ef.event_id = e.id and ef.family_id in (select public.my_family_ids())
          ))
        )
    )
  );

-- Insert: any registered user who can read the parent event
create policy "Registered users can comment on visible events"
  on comments for insert with check (
    auth.uid() is not null
    and exists (
      select 1 from events e
      where e.id = comments.event_id
        and (e.visibility in ('open', 'public') or exists (
          select 1 from event_families ef
          where ef.event_id = e.id and ef.family_id in (select public.my_family_ids())
        ))
    )
  );
```

### `families`
```sql
create policy "Families readable by visibility tier"
  on families for select using (
    visibility = 'public'
    or (visibility = 'open' and auth.uid() is not null)
    or id in (select public.my_family_ids())
  );
```

---

## UI gates

| Action | Required |
|---|---|
| Set event visibility | Event creator or family admin |
| Set story visibility (private/family/open/public) | Story author or family admin |
| Publish a story (private → family) | Story author |
| Unpublish a story (family → private) | Story author or family admin |
| Set family visibility | Family admin |
| Comment on open/public event | Any registered user |
| RSVP on open/public event | Any registered user |
| Read public event or story | Anyone (no login) |
| View family tree | Family members only — always |
| View member list | Family members only — always |

---

## Invariants (must never be violated)

- Family tree and member list are always `family` tier — no code path may make them `open` or `public`
- Anonymous comments are never allowed on any content tier
- Public event page does not reveal which family it belongs to
- Visibility of content is independent of family visibility — they are orthogonal settings

---

## Consequences

- New migration: `visibility` column on `families`, `events`, `updates` (with backfill); updated RLS on all three + `comments`
- Story `visibility = 'private'` replaces the current draft heuristic (`content?.trim()`). The Drafts tab query changes from a content check to `visibility = 'private'`.
- Client queries (`fetchUpdates`, `fetchActiveEvents`, `fetchAllEvents`) return more results for logged-out users (public content) — callers must handle unauthenticated state
- New routes or route guards: public event/story pages accessible without session
- Visibility picker in event creation form and story publish step (family admin can also override)
- Family Settings: new "Family visibility" setting in a General tab
- Pre-push checklist: verify family tree and member list queries never use non-`family` visibility
