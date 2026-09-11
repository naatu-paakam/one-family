-- Repair: ensure all RLS policies on updates, events, comments are correct.
-- Also fix data consistency: 2 orphaned stories + delete test events.
-- ADR-009, ADR-010

-- ── Re-assert all INSERT / UPDATE / DELETE policies on updates ────────────────
-- (These should already exist from schema.sql, but re-apply defensively)

drop policy if exists "Authenticated users can insert updates"       on public.updates;
drop policy if exists "Authors can update their own updates"         on public.updates;
drop policy if exists "Portal admins can update any update"          on public.updates;
drop policy if exists "Authors can delete their own updates"         on public.updates;
drop policy if exists "Portal admins can delete any update"          on public.updates;
drop policy if exists "Admins can update any update"                 on public.updates;
drop policy if exists "Admins can delete any update"                 on public.updates;

-- INSERT: any authenticated user can create a story
create policy "Authenticated users can insert updates"
  on public.updates for insert
  with check (auth.uid() is not null);

-- UPDATE: own story OR portal admin
create policy "Authors or admins can update updates"
  on public.updates for update
  using (
    author_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and is_portal_admin = true)
    or exists (
      select 1 from public.story_families sf
      join public.family_members fm on fm.family_id = sf.family_id
      where sf.story_id = updates.id
        and fm.user_id = auth.uid()
        and fm.role = 'admin'
    )
  );

-- DELETE: own story OR portal admin OR family admin
create policy "Authors or admins can delete updates"
  on public.updates for delete
  using (
    author_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and is_portal_admin = true)
    or exists (
      select 1 from public.story_families sf
      join public.family_members fm on fm.family_id = sf.family_id
      where sf.story_id = updates.id
        and fm.user_id = auth.uid()
        and fm.role = 'admin'
    )
  );

-- ── Re-assert events INSERT / UPDATE / DELETE policies ────────────────────────

drop policy if exists "Logged-in users can create events"   on public.events;
drop policy if exists "Creator or admin can update event"   on public.events;
drop policy if exists "Creator or portal admin can update event" on public.events;

create policy "Authenticated users can create events"
  on public.events for insert
  with check (auth.uid() is not null);

create policy "Creator or admin can update event"
  on public.events for update
  using (
    created_by = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and is_portal_admin = true)
    or exists (
      select 1 from public.event_families ef
      join public.family_members fm on fm.family_id = ef.family_id
      where ef.event_id = events.id
        and fm.user_id = auth.uid()
        and fm.role = 'admin'
    )
  );

-- ── Fix data: link the 2 orphaned published stories to NaatuPaakam ────────────
-- These had family_id=NULL at migration time; author is a NaatuPaakam admin.

insert into public.story_families (story_id, family_id)
values
  ('bd6c3cc5-8136-405f-9eaf-a9a41ed933b8', '842eda43-7cc9-4b32-bee3-f2aaa72d4d4b'),  -- Reunion Prep
  ('de149ab5-3f88-408f-9cc3-caaea4f4525a', '842eda43-7cc9-4b32-bee3-f2aaa72d4d4b')   -- With friends from College
on conflict do nothing;

-- ── Clean up test events ──────────────────────────────────────────────────────
-- Delete "Playwright Test Event" and "TestEvent2" (closed test data)

delete from public.events
where id in (
  'e04e31a6-93ff-4bb0-a6a0-90c058844c32',  -- Playwright Test Event
  '1e0ff5f2-c4fb-4bcf-8b6f-9cfbac9bcff9'   -- TestEvent2
);
-- event_families and invites cascade via FK on delete cascade
