-- Add invited_user_id to invites so the invited person can RSVP their own row.
-- Tighten UPDATE policy: only organizer or the invited user may change status.

alter table public.invites
  add column if not exists invited_user_id uuid references public.profiles(id) on delete set null;

-- UPDATE: organizer (invited_by / event creator / family admin) OR the invited user
drop policy if exists "Logged-in users can update invites" on public.invites;

create policy "Organizer or invited user can update invite"
  on public.invites for update
  using (
    invited_by = auth.uid()
    or invited_user_id = auth.uid()
    or exists (
      select 1 from public.events e
      where e.id = invites.event_id and e.created_by = auth.uid()
    )
    or exists (
      select 1 from public.events e
      join public.event_families ef on ef.event_id = e.id
      join public.family_members fm on fm.family_id = ef.family_id
      where e.id = invites.event_id
        and fm.user_id = auth.uid()
        and fm.role = 'admin'
    )
    or exists (select 1 from public.profiles where id = auth.uid() and is_portal_admin = true)
  );
