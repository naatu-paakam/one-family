-- comments_enabled on stories (author-controlled, default off)
alter table public.updates
  add column if not exists comments_enabled boolean not null default false;

-- story_id on comments (nullable; either event_id or story_id set, never both)
alter table public.comments
  add column if not exists story_id uuid references public.updates(id) on delete cascade;

do $$ begin
  alter table public.comments
    add constraint comments_one_parent
    check (
      (event_id is not null and story_id is null)
      or (story_id is not null and event_id is null)
    );
exception when duplicate_object then null;
end $$;

-- SELECT: extend to cover story comments
drop policy if exists "Comments readable by registered users on visible events" on public.comments;
drop policy if exists "Comments readable by registered users on visible content" on public.comments;

create policy "Comments readable by registered users on visible content"
  on public.comments for select using (
    auth.uid() is not null
    and (
      (event_id is not null and exists (
        select 1 from public.events e where e.id = comments.event_id
        and (
          e.visibility in ('open', 'public')
          or (e.visibility = 'family' and exists (
            select 1 from public.event_families ef
            where ef.event_id = e.id and ef.family_id in (select public.my_family_ids())
          ))
        )
      ))
      or (story_id is not null and exists (
        select 1 from public.updates u where u.id = comments.story_id
        and u.comments_enabled = true
        and (
          u.visibility in ('open', 'public')
          or (u.visibility = 'family' and exists (
            select 1 from public.story_families sf
            where sf.story_id = u.id and sf.family_id in (select public.my_family_ids())
          ))
        )
      ))
    )
  );

-- INSERT: extend to cover story comments
drop policy if exists "Registered users can comment on visible events" on public.comments;
drop policy if exists "Registered users can comment on visible content" on public.comments;

create policy "Registered users can comment on visible content"
  on public.comments for insert with check (
    auth.uid() is not null
    and (
      (event_id is not null and exists (
        select 1 from public.events e where e.id = comments.event_id
        and (e.visibility in ('open', 'public') or exists (
          select 1 from public.event_families ef
          where ef.event_id = e.id and ef.family_id in (select public.my_family_ids())
        ))
      ))
      or (story_id is not null and exists (
        select 1 from public.updates u where u.id = comments.story_id
        and u.comments_enabled = true
        and (
          u.visibility in ('open', 'public')
          or (u.visibility = 'family' and exists (
            select 1 from public.story_families sf
            where sf.story_id = u.id and sf.family_id in (select public.my_family_ids())
          ))
        )
      ))
    )
  );

-- comment_reactions: extend SELECT to cover story comment reactions
drop policy if exists "Reactions readable by registered users on visible events" on public.comment_reactions;
drop policy if exists "Reactions readable by registered users on visible content" on public.comment_reactions;

create policy "Reactions readable by registered users on visible content"
  on public.comment_reactions for select using (
    auth.uid() is not null
    and exists (
      select 1 from public.comments c
      where c.id = comment_reactions.comment_id
      and (
        (c.event_id is not null and exists (
          select 1 from public.events e where e.id = c.event_id
          and (e.visibility in ('open', 'public') or exists (
            select 1 from public.event_families ef
            where ef.event_id = e.id and ef.family_id in (select public.my_family_ids())
          ))
        ))
        or (c.story_id is not null and exists (
          select 1 from public.updates u where u.id = c.story_id
          and u.comments_enabled = true
          and (u.visibility in ('open', 'public') or exists (
            select 1 from public.story_families sf
            where sf.story_id = u.id and sf.family_id in (select public.my_family_ids())
          ))
        ))
      )
    )
  );
