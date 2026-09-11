-- MVP M1: Rename profiles.is_admin → is_portal_admin
-- Updates all RLS policies that referenced the old column name.

alter table profiles rename column is_admin to is_portal_admin;

-- ── Update RLS policies on updates ───────────────────────────────────────────

drop policy if exists "Admins can update any update" on updates;
drop policy if exists "Admins can delete any update" on updates;

create policy "Portal admins can update any update"
  on updates for update
  using (exists (select 1 from profiles where id = auth.uid() and is_portal_admin));

create policy "Portal admins can delete any update"
  on updates for delete
  using (exists (select 1 from profiles where id = auth.uid() and is_portal_admin));

-- ── Update RLS policies on summaries ─────────────────────────────────────────

drop policy if exists "Admins can insert summaries" on summaries;

create policy "Portal admins can insert summaries"
  on summaries for insert
  with check (exists (select 1 from profiles where id = auth.uid() and is_portal_admin));

-- ── Update RLS policies on events ────────────────────────────────────────────

drop policy if exists "Creator or admin can update event" on events;

create policy "Creator or portal admin can update event"
  on events for update
  using (
    auth.uid() = created_by
    or exists (select 1 from profiles where id = auth.uid() and is_portal_admin)
  );
