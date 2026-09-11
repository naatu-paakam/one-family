-- Portal admin backend — security-definer RPCs that bypass RLS for portal admins.
-- All functions validate is_portal_admin = true before executing.
-- ADR-002

-- ── Add suspended_at to families ─────────────────────────────────────────────

alter table families add column if not exists suspended_at timestamptz;

-- ── Helper: assert caller is portal admin (public schema) ─────────────────────

create or replace function public.assert_portal_admin()
returns void language plpgsql security definer as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_portal_admin = true
  ) then
    raise exception 'Requires portal admin access';
  end if;
end;
$$;

-- ── RPC: fetch all families (with member count) for portal admin ───────────────

create or replace function public.portal_fetch_families()
returns table (
  id              uuid,
  name            text,
  invite_code     text,
  created_by      uuid,
  created_at      timestamptz,
  bio             text,
  suspended_at    timestamptz,
  member_count    bigint
)
language sql security definer stable as $$
  select
    f.id,
    f.name,
    f.invite_code,
    f.created_by,
    f.created_at,
    f.bio,
    f.suspended_at,
    count(fm.id) as member_count
  from public.families f
  left join public.family_members fm on fm.family_id = f.id
  where exists (
    select 1 from public.profiles where id = auth.uid() and is_portal_admin = true
  )
  group by f.id
  order by f.created_at desc;
$$;

-- ── RPC: fetch all profiles for portal admin ──────────────────────────────────

create or replace function public.portal_fetch_profiles()
returns table (
  id              uuid,
  full_name       text,
  avatar_url      text,
  is_portal_admin boolean,
  created_at      timestamptz,
  family_count    bigint
)
language sql security definer stable as $$
  select
    p.id,
    p.full_name,
    p.avatar_url,
    p.is_portal_admin,
    p.created_at,
    count(fm.id) as family_count
  from public.profiles p
  left join public.family_members fm on fm.user_id = p.id
  where exists (
    select 1 from public.profiles where id = auth.uid() and is_portal_admin = true
  )
  group by p.id
  order by p.created_at desc;
$$;

-- ── RPC: suspend a family ─────────────────────────────────────────────────────

create or replace function public.portal_suspend_family(p_family_id uuid)
returns void language plpgsql security definer as $$
begin
  perform public.assert_portal_admin();
  update public.families set suspended_at = now() where id = p_family_id;
end;
$$;

-- ── RPC: unsuspend a family ───────────────────────────────────────────────────

create or replace function public.portal_unsuspend_family(p_family_id uuid)
returns void language plpgsql security definer as $$
begin
  perform public.assert_portal_admin();
  update public.families set suspended_at = null where id = p_family_id;
end;
$$;

-- ── RPC: promote user to portal admin ────────────────────────────────────────

create or replace function public.portal_promote_admin(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  perform public.assert_portal_admin();
  update public.profiles set is_portal_admin = true where id = p_user_id;
end;
$$;

-- ── RPC: demote portal admin ──────────────────────────────────────────────────

create or replace function public.portal_demote_admin(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  perform public.assert_portal_admin();
  -- Cannot demote yourself
  if p_user_id = auth.uid() then
    raise exception 'Cannot demote yourself';
  end if;
  update public.profiles set is_portal_admin = false where id = p_user_id;
end;
$$;
