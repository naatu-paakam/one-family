-- ── Families (no member-check policy yet — family_members doesn't exist yet) ──

create table if not exists families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table families enable row level security;

create policy "Authenticated users can create families"
  on families for insert
  with check (auth.uid() is not null);

-- ── Family Members ────────────────────────────────────────────────────────────

create table if not exists family_members (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  role        text not null default 'member',
  joined_at   timestamptz not null default now(),
  unique (family_id, user_id)
);

alter table family_members enable row level security;

create policy "Family members can view memberships"
  on family_members for select
  using (
    exists (
      select 1 from family_members fm2
      where fm2.family_id = family_members.family_id
        and fm2.user_id = auth.uid()
    )
  );

create policy "Authenticated users can join families"
  on family_members for insert
  with check (auth.uid() = user_id);

create policy "Users can leave a family"
  on family_members for delete
  using (auth.uid() = user_id);

-- ── Now add member-check policies to families ─────────────────────────────────

create policy "Family members can view their families"
  on families for select
  using (
    exists (
      select 1 from family_members
      where family_members.family_id = families.id
        and family_members.user_id = auth.uid()
    )
  );

create policy "Family admins can update family"
  on families for update
  using (
    exists (
      select 1 from family_members
      where family_members.family_id = families.id
        and family_members.user_id = auth.uid()
        and family_members.role = 'admin'
    )
  );

-- ── Add family_id to updates, events, invites ─────────────────────────────────

alter table updates add column if not exists family_id uuid references families(id) on delete set null;
alter table events  add column if not exists family_id uuid references families(id) on delete set null;
alter table invites add column if not exists family_id uuid references families(id) on delete set null;

-- ── Default family + migrate existing data ────────────────────────────────────

do $$
declare
  v_family_id uuid;
  v_first_user uuid;
begin
  select id into v_first_user from profiles order by created_at limit 1;

  if v_first_user is not null then
    insert into families (name, invite_code, created_by)
    values ('NaatuPaakam', 'naatu-001', v_first_user)
    returning id into v_family_id;

    insert into family_members (family_id, user_id, role)
    select v_family_id, id, 'admin'
    from profiles
    on conflict (family_id, user_id) do nothing;

    update updates set family_id = v_family_id where family_id is null;
    update events  set family_id = v_family_id where family_id is null;
    update invites set family_id = v_family_id where family_id is null;
  end if;
end;
$$;
