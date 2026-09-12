-- Add DELETE RLS policy on events: creator or family admin or portal admin.

create policy "Creator or admin can delete event"
  on public.events for delete
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
