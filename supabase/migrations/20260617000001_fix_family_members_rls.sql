-- Fix: infinite recursion in family_members RLS policy.
-- The original policy queried family_members from within family_members,
-- causing Postgres to recurse infinitely. Replace with a simple own-row policy
-- and a security-definer function for cross-member lookups.

drop policy if exists "Family members can view memberships" on family_members;

-- Users can always see their own membership rows (no self-reference)
create policy "Users can view own memberships"
  on family_members for select
  using (auth.uid() = user_id);

-- Security-definer function returns family_ids the current user belongs to
-- without triggering RLS on family_members (runs as the function owner)
create or replace function public.my_family_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select family_id from family_members where user_id = auth.uid();
$$;

-- Families: replace member-check policy with function-based one (no recursion)
drop policy if exists "Family members can view their families" on families;

create policy "Family members can view their families"
  on families for select
  using (id in (select public.my_family_ids()));
