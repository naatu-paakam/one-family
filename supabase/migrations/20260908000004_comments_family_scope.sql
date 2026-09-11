-- MVP M1: Comments derive family scope from their parent event via event_families.
-- Drops comments.family_id — visibility is now inherited from the event (ADR-009).

-- ── Drop old RLS policies that used comments.family_id ───────────────────────

drop policy if exists "Comments readable by family members" on comments;
drop policy if exists "Reactions readable by family members" on comment_reactions;

-- ── Drop family_id column from comments ──────────────────────────────────────

alter table comments drop column if exists family_id;

-- ── New RLS: derive visibility from parent event's family memberships ─────────

create policy "Comments readable by event family members"
  on comments for select
  using (
    exists (
      select 1 from event_families ef
      where ef.event_id = comments.event_id
        and ef.family_id in (select public.my_family_ids())
    )
  );

-- ── New RLS: comment reactions follow the same scope ─────────────────────────

create policy "Reactions readable by event family members"
  on comment_reactions for select
  using (
    exists (
      select 1 from comments c
      join event_families ef on ef.event_id = c.event_id
      where c.id = comment_reactions.comment_id
        and ef.family_id in (select public.my_family_ids())
    )
  );

-- Insert: any authenticated user who can see the event can comment
drop policy if exists "Authenticated users can insert comments" on comments;

create policy "Family members can insert comments"
  on comments for insert
  with check (
    auth.uid() is not null
    and exists (
      select 1 from event_families ef
      where ef.event_id = comments.event_id
        and ef.family_id in (select public.my_family_ids())
    )
  );
