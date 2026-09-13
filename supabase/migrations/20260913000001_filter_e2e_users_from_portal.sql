-- Filter out E2E test users from the portal user list.
-- Also add a helper RPC for teardown to find and delete them.
-- Test accounts follow the pattern: e2e-reg-<timestamp>@naatupakam.family
-- These are created by Playwright auth tests and should not appear in production portal views.
-- auth.users is accessible from security-definer functions.

drop function if exists public.portal_fetch_profiles() cascade;
create or replace function public.portal_fetch_profiles()
returns table (
  id              uuid,
  full_name       text,
  avatar_url      text,
  is_portal_admin boolean,
  created_at      timestamptz,
  family_count    bigint,
  email           text
)
language sql security definer stable as $$
  select
    p.id,
    p.full_name,
    p.avatar_url,
    p.is_portal_admin,
    p.created_at,
    count(fm.id) as family_count,
    u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.family_members fm on fm.user_id = p.id
  where exists (
    select 1 from public.profiles where id = auth.uid() and is_portal_admin = true
  )
  -- Exclude E2E test accounts (pattern: e2e-reg-*@naatupakam.family)
  and u.email not like 'e2e-%'
  group by p.id, u.email
  order by p.created_at desc;
$$;

-- Helper for Playwright teardown: returns UUIDs of all lingering E2E test users
-- so they can be deleted via portal_delete_user one by one.
create or replace function public.portal_fetch_e2e_user_ids()
returns setof uuid
language sql security definer stable as $$
  select u.id
  from auth.users u
  where u.email like 'e2e-%'
    and exists (
      select 1 from public.profiles where id = auth.uid() and is_portal_admin = true
    );
$$;
