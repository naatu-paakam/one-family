-- Fix: family_members DELETE policy caused infinite recursion.
-- The EXISTS(SELECT FROM family_members) inside the USING clause triggered
-- SELECT RLS on family_members, which re-evaluated the same policy tree.
--
-- Fix: introduce is_family_admin(family_id) as a SECURITY DEFINER function
-- so it reads family_members without triggering RLS, then use it in the
-- DELETE USING clause to avoid any recursive policy evaluation.

create or replace function public.is_family_admin(p_family_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.family_members
    where family_id  = p_family_id
      and user_id    = auth.uid()
      and role       = 'admin'
  );
$$;

-- Also useful helper: is the current user a portal admin?
create or replace function public.is_portal_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_portal_admin = true
  );
$$;

-- Rebuild DELETE policy using the new security-definer helpers (no recursion)
drop policy if exists "Users can leave or admins can remove from family" on public.family_members;

create policy "Users can leave or admins can remove from family"
  on public.family_members for delete
  using (
    -- own membership (voluntary leave)
    auth.uid() = user_id
    -- family admin removing any member from their family
    or public.is_family_admin(family_members.family_id)
    -- portal admin can remove anyone
    or public.is_portal_admin()
  );

-- Also rebuild UPDATE policy with the same helpers to prevent future recursion
drop policy if exists "Family admins can update member roles" on public.family_members;

create policy "Family admins can update member roles"
  on public.family_members for update
  using  (public.is_family_admin(family_members.family_id))
  with check (role = any (array['admin'::text, 'member'::text]));
