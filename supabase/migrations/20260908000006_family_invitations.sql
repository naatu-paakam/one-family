-- MVP M2: Individual invite tokens (copy-paste, no email) — ADR-004.
-- Also adds rotate_invite_code RPC and family admin role-update RLS.

-- ── family_invitations table ──────────────────────────────────────────────────

create table family_invitations (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  invited_by  uuid not null references profiles(id) on delete cascade,
  token       uuid not null unique default gen_random_uuid(),
  expires_at  timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

alter table family_invitations enable row level security;

-- Family admins can create invitation tokens for their family
create policy "Family admins can create invitations"
  on family_invitations for insert
  with check (
    exists (
      select 1 from family_members
      where family_id = family_invitations.family_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

-- Family admins can view their family's invitations
create policy "Family admins can view invitations"
  on family_invitations for select
  using (
    exists (
      select 1 from family_members
      where family_id = family_invitations.family_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

-- Family admins can revoke (delete) pending invitations
create policy "Family admins can revoke invitations"
  on family_invitations for delete
  using (
    exists (
      select 1 from family_members
      where family_id = family_invitations.family_id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

-- ── RPC: generate a personal invite token ────────────────────────────────────

create or replace function public.generate_family_invitation(p_family_id uuid)
returns uuid
language plpgsql security definer as $$
declare
  v_token uuid;
begin
  -- Must be family admin
  if not exists (
    select 1 from family_members
    where family_id = p_family_id
      and user_id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'Not authorized — must be family admin';
  end if;

  insert into family_invitations (family_id, invited_by)
  values (p_family_id, auth.uid())
  returning token into v_token;

  return v_token;
end;
$$;

-- ── RPC: join a family via personal invite token ──────────────────────────────

create or replace function public.join_family_by_token(p_token uuid)
returns uuid
language plpgsql security definer as $$
declare
  v_family_id     uuid;
  v_invitation_id uuid;
begin
  -- Find a valid (not expired, not used) invitation
  select id, family_id into v_invitation_id, v_family_id
  from family_invitations
  where token = p_token
    and expires_at > now()
    and accepted_at is null;

  if v_family_id is null then
    raise exception 'Invalid or expired invitation token';
  end if;

  -- Join as member (idempotent)
  insert into family_members (family_id, user_id, role)
  values (v_family_id, auth.uid(), 'member')
  on conflict (family_id, user_id) do nothing;

  -- Mark invitation used
  update family_invitations set accepted_at = now() where id = v_invitation_id;

  return v_family_id;
end;
$$;

-- ── RPC: rotate group invite code ────────────────────────────────────────────

create or replace function public.rotate_invite_code(p_family_id uuid)
returns text
language plpgsql security definer as $$
declare
  v_new_code text;
begin
  if not exists (
    select 1 from family_members
    where family_id = p_family_id
      and user_id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'Not authorized — must be family admin';
  end if;

  v_new_code := substr(md5(random()::text), 1, 8);
  update families set invite_code = v_new_code where id = p_family_id;
  return v_new_code;
end;
$$;

-- ── RLS: allow family admins to update member roles ───────────────────────────

create policy "Family admins can update member roles"
  on family_members for update
  using (
    -- Must be an admin of this family
    exists (
      select 1 from family_members fm2
      where fm2.family_id = family_members.family_id
        and fm2.user_id = auth.uid()
        and fm2.role = 'admin'
    )
  )
  with check (
    -- Can only set role to 'admin' or 'member'
    role in ('admin', 'member')
  );
