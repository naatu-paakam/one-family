-- MVP M1: Replace updates.family_id (single FK) with story_families junction table.
-- Allows a story to be published to multiple families (ADR-009).

-- ── Create junction table ─────────────────────────────────────────────────────

create table story_families (
  story_id  uuid not null references updates(id) on delete cascade,
  family_id uuid not null references families(id) on delete cascade,
  primary key (story_id, family_id)
);

alter table story_families enable row level security;

-- ── Backfill from existing single family_id ───────────────────────────────────

insert into story_families (story_id, family_id)
select id, family_id
from updates
where family_id is not null;

-- ── Drop old column ───────────────────────────────────────────────────────────

alter table updates drop column if exists family_id;

-- ── RLS on story_families ─────────────────────────────────────────────────────

-- Any member of that family can see which stories belong to it
create policy "Family members can view story_families"
  on story_families for select
  using (family_id in (select public.my_family_ids()));

-- Author (who must be a member of that family) can link story to it
create policy "Author can publish story to own family"
  on story_families for insert
  with check (
    family_id in (select public.my_family_ids())
    and exists (
      select 1 from updates where id = story_id and author_id = auth.uid()
    )
  );

-- Author, family admin, or portal admin can remove story from a family
create policy "Author or admin can remove story from family"
  on story_families for delete
  using (
    exists (select 1 from updates where id = story_id and author_id = auth.uid())
    or exists (
      select 1 from family_members
      where family_id = story_families.family_id
        and user_id = auth.uid()
        and role = 'admin'
    )
    or exists (select 1 from profiles where id = auth.uid() and is_portal_admin)
  );

-- ── Update RLS on updates to use junction table ───────────────────────────────

-- Stories are private — only visible to members of families the story belongs to
drop policy if exists "Updates are publicly readable" on updates;

create policy "Stories readable by family members"
  on updates for select
  using (
    exists (
      select 1 from story_families sf
      where sf.story_id = updates.id
        and sf.family_id in (select public.my_family_ids())
    )
  );

-- ── RPC: publish story to a family (validates author is a member) ─────────────

create or replace function public.publish_story_to_family(p_story_id uuid, p_family_id uuid)
returns void
language plpgsql security definer as $$
begin
  -- Caller must be the story author
  if not exists (select 1 from updates where id = p_story_id and author_id = auth.uid()) then
    raise exception 'Not the story author';
  end if;
  -- Caller must be a member of the target family
  if p_family_id not in (select public.my_family_ids()) then
    raise exception 'Not a member of that family';
  end if;

  insert into story_families (story_id, family_id)
  values (p_story_id, p_family_id)
  on conflict do nothing;
end;
$$;

-- ── RPC: remove story from a family ──────────────────────────────────────────

create or replace function public.remove_story_from_family(p_story_id uuid, p_family_id uuid)
returns void
language plpgsql security definer as $$
begin
  if not (
    -- author
    exists (select 1 from updates where id = p_story_id and author_id = auth.uid())
    or
    -- family admin
    exists (select 1 from family_members where family_id = p_family_id and user_id = auth.uid() and role = 'admin')
    or
    -- portal admin
    exists (select 1 from profiles where id = auth.uid() and is_portal_admin)
  ) then
    raise exception 'Not authorized';
  end if;

  delete from story_families where story_id = p_story_id and family_id = p_family_id;
end;
$$;
