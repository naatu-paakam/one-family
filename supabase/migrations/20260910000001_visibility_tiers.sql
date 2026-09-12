-- ADR-010: Visibility tiers for stories, events, and families.
-- Stories: private | family | open | public
-- Events:  family  | open   | public
-- Families: private | open  | public

-- ── Add visibility columns ────────────────────────────────────────────────────

alter table updates add column if not exists visibility text not null default 'private'
  check (visibility in ('private', 'family', 'open', 'public'));

alter table events add column if not exists visibility text not null default 'family'
  check (visibility in ('family', 'open', 'public'));

alter table families add column if not exists visibility text not null default 'private'
  check (visibility in ('private', 'open', 'public'));

-- ── Backfill stories ──────────────────────────────────────────────────────────
-- Stories with content → 'family' (published); without content → 'private' (draft)

update updates set visibility = case
  when content is not null and trim(content) <> '' then 'family'
  else 'private'
end;

-- ── Update RLS on updates (stories) ──────────────────────────────────────────

drop policy if exists "Updates are publicly readable"           on updates;
drop policy if exists "Stories readable by family members"      on updates;
drop policy if exists "Stories readable by visibility tier"     on updates;

create policy "Stories readable by visibility tier"
  on updates for select using (
    -- private: author only
    (visibility = 'private' and author_id = auth.uid())
    -- family: members of any publishing family
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

-- ── Update RLS on events ──────────────────────────────────────────────────────

drop policy if exists "Events viewable by everyone"           on events;
drop policy if exists "Events readable by family members"     on events;
drop policy if exists "Events readable by visibility tier"    on events;

create policy "Events readable by visibility tier"
  on events for select using (
    -- family: members of any publishing family
    (visibility = 'family' and exists (
      select 1 from event_families ef
      where ef.event_id = events.id
        and ef.family_id in (select public.my_family_ids())
    ))
    -- open: any registered user
    or (visibility = 'open' and auth.uid() is not null)
    -- public: anyone
    or visibility = 'public'
  );

-- ── Update RLS on families ────────────────────────────────────────────────────

drop policy if exists "Family members can view their families"  on families;
drop policy if exists "Families readable by visibility tier"    on families;

create policy "Families readable by visibility tier"
  on families for select using (
    -- always visible to own members
    id in (select public.my_family_ids())
    -- open: any registered user
    or (visibility = 'open' and auth.uid() is not null)
    -- public: anyone
    or visibility = 'public'
  );

-- ── Update RLS on comments ────────────────────────────────────────────────────
-- Comments are readable by registered users who can see the parent event.

drop policy if exists "Comments readable by family members"                          on comments;
drop policy if exists "Comments readable by event family members"                    on comments;
drop policy if exists "Family members can insert comments"                           on comments;
drop policy if exists "Authenticated users can insert comments"                      on comments;
drop policy if exists "Comments readable by registered users on visible events"      on comments;
drop policy if exists "Registered users can comment on visible events"               on comments;

create policy "Comments readable by registered users on visible events"
  on comments for select using (
    auth.uid() is not null
    and exists (
      select 1 from events e where e.id = comments.event_id
      and (
        e.visibility in ('open', 'public')
        or (e.visibility = 'family' and exists (
          select 1 from event_families ef
          where ef.event_id = e.id
            and ef.family_id in (select public.my_family_ids())
        ))
      )
    )
  );

create policy "Registered users can comment on visible events"
  on comments for insert with check (
    auth.uid() is not null
    and exists (
      select 1 from events e where e.id = comments.event_id
      and (
        e.visibility in ('open', 'public')
        or (e.visibility = 'family' and exists (
          select 1 from event_families ef
          where ef.event_id = e.id
            and ef.family_id in (select public.my_family_ids())
        ))
      )
    )
  );

-- ── Update RLS on comment_reactions ──────────────────────────────────────────

drop policy if exists "Reactions readable by event family members"                on comment_reactions;
drop policy if exists "Reactions readable by registered users on visible events"  on comment_reactions;

create policy "Reactions readable by registered users on visible events"
  on comment_reactions for select using (
    auth.uid() is not null
    and exists (
      select 1 from comments c
      join events e on e.id = c.event_id
      where c.id = comment_reactions.comment_id
        and (
          e.visibility in ('open', 'public')
          or (e.visibility = 'family' and exists (
            select 1 from event_families ef
            where ef.event_id = e.id
              and ef.family_id in (select public.my_family_ids())
          ))
        )
    )
  );

-- ── RPC: update family visibility (family admin or portal admin) ──────────────

create or replace function public.update_family_visibility(p_family_id uuid, p_visibility text)
returns void language plpgsql security definer as $$
begin
  if p_visibility not in ('private', 'open', 'public') then
    raise exception 'Invalid visibility value';
  end if;
  if not (
    exists (select 1 from family_members where family_id = p_family_id and user_id = auth.uid() and role = 'admin')
    or exists (select 1 from profiles where id = auth.uid() and is_portal_admin = true)
  ) then
    raise exception 'Not authorized';
  end if;
  update families set visibility = p_visibility where id = p_family_id;
end;
$$;
