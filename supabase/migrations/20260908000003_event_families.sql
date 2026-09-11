-- MVP M1: Replace events.family_id (single FK) with event_families junction table.
-- Allows an event to be shared across multiple families (ADR-009).

-- ── Create junction table ─────────────────────────────────────────────────────

create table event_families (
  event_id  uuid not null references events(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  primary key (event_id, family_id)
);

alter table event_families enable row level security;

-- ── Backfill from existing single family_id ───────────────────────────────────

insert into event_families (event_id, family_id)
select id, family_id
from events
where family_id is not null;

-- ── Drop old column ───────────────────────────────────────────────────────────

alter table events drop column if exists family_id;

-- Drop family_id from invites too (event RSVP invites inherit family scope from event_families)
alter table invites drop column if exists family_id;

-- ── RLS on event_families ─────────────────────────────────────────────────────

create policy "Family members can view event_families"
  on event_families for select
  using (family_id in (select public.my_family_ids()));

-- Creator (who must be a member of that family) can link event to it
create policy "Creator can share event to own family"
  on event_families for insert
  with check (
    family_id in (select public.my_family_ids())
    and exists (
      select 1 from events where id = event_id and created_by = auth.uid()
    )
  );

-- Creator, family admin, or portal admin can remove event from a family
create policy "Creator or admin can remove event from family"
  on event_families for delete
  using (
    exists (select 1 from events where id = event_id and created_by = auth.uid())
    or exists (
      select 1 from family_members
      where family_id = event_families.family_id
        and user_id = auth.uid()
        and role = 'admin'
    )
    or exists (select 1 from profiles where id = auth.uid() and is_portal_admin)
  );

-- ── Update RLS on events ──────────────────────────────────────────────────────

-- Events are private — visible only to members of families the event belongs to
drop policy if exists "Events viewable by everyone" on events;

create policy "Events readable by family members"
  on events for select
  using (
    exists (
      select 1 from event_families ef
      where ef.event_id = events.id
        and ef.family_id in (select public.my_family_ids())
    )
  );

-- ── RPC: share event to a family (validates creator is a member) ──────────────

create or replace function public.share_event_to_family(p_event_id uuid, p_family_id uuid)
returns void
language plpgsql security definer as $$
begin
  if not exists (select 1 from events where id = p_event_id and created_by = auth.uid()) then
    raise exception 'Not the event creator';
  end if;
  if p_family_id not in (select public.my_family_ids()) then
    raise exception 'Not a member of that family';
  end if;

  insert into event_families (event_id, family_id)
  values (p_event_id, p_family_id)
  on conflict do nothing;
end;
$$;

-- ── RPC: remove event from a family ──────────────────────────────────────────

create or replace function public.remove_event_from_family(p_event_id uuid, p_family_id uuid)
returns void
language plpgsql security definer as $$
begin
  if not (
    exists (select 1 from events where id = p_event_id and created_by = auth.uid())
    or exists (select 1 from family_members where family_id = p_family_id and user_id = auth.uid() and role = 'admin')
    or exists (select 1 from profiles where id = auth.uid() and is_portal_admin)
  ) then
    raise exception 'Not authorized';
  end if;

  delete from event_families where event_id = p_event_id and family_id = p_family_id;
end;
$$;
