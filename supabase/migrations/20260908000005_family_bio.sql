-- MVP M2: Add optional bio field to families (ADR-003).
-- Only family admins can edit; displayed on home page when non-null.

alter table families add column if not exists bio text;

-- ── RPC: update family bio (family admin or portal admin only) ────────────────

create or replace function public.update_family_bio(p_family_id uuid, p_bio text)
returns void
language plpgsql security definer as $$
begin
  if not (
    exists (
      select 1 from family_members
      where family_id = p_family_id
        and user_id = auth.uid()
        and role = 'admin'
    )
    or exists (select 1 from profiles where id = auth.uid() and is_portal_admin)
  ) then
    raise exception 'Not authorized — must be family admin or portal admin';
  end if;

  update families set bio = p_bio where id = p_family_id;
end;
$$;

-- ── RLS: add family admin update policy (families can now be updated for bio) ─

-- Allow family admins to update any column on their family (including bio)
-- The existing "Family admins can update family" policy on families already covers this.
-- No new policy needed — existing policy uses role = 'admin' check.
