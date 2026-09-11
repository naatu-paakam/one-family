-- ADR-012: Replace family_trees JSONB blob with family_tree_nodes flat table.
-- Each member is a row. Tree structure expressed via parent_id (adjacency list).
-- Supports 1000+ nodes with row-level saves, search, and no concurrent edit conflicts.

-- ── Create flat node table ────────────────────────────────────────────────────

create table public.family_tree_nodes (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families(id) on delete cascade,
  parent_id    uuid references public.family_tree_nodes(id) on delete cascade,

  -- Core identity
  name         text not null default 'New Member',
  born         text,
  avatar       text,
  user_id      uuid references public.profiles(id) on delete set null,

  -- Partner / spouse (Option A — ADR TBD)
  partner_name text,
  partner_born text,

  -- Contact (always private per ADR-010)
  email        text,
  phone        text,
  address      text,

  -- Sibling ordering within a parent
  sort_order   int not null default 0,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Touch updated_at on any update
create trigger family_tree_nodes_updated_at
  before update on public.family_tree_nodes
  for each row execute procedure public.touch_updated_at();

-- Indexes for common queries
create index on public.family_tree_nodes(family_id);
create index on public.family_tree_nodes(parent_id);
create index on public.family_tree_nodes(user_id);
create index on public.family_tree_nodes using gin(to_tsvector('simple', name));

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.family_tree_nodes enable row level security;

create policy "Family members can view tree nodes"
  on public.family_tree_nodes for select
  using (family_id in (select public.my_family_ids()));

create policy "Family members can insert tree nodes"
  on public.family_tree_nodes for insert
  with check (family_id in (select public.my_family_ids()));

create policy "Family members can update tree nodes"
  on public.family_tree_nodes for update
  using (family_id in (select public.my_family_ids()));

create policy "Family members can delete tree nodes"
  on public.family_tree_nodes for delete
  using (family_id in (select public.my_family_ids()));

-- ── Migrate existing JSONB trees to flat rows ─────────────────────────────────

create or replace function public.migrate_jsonb_node(
  p_family_id uuid,
  p_node      jsonb,
  p_parent_id uuid,
  p_order     int
) returns uuid language plpgsql as $$
declare
  v_id     uuid;
  v_child  jsonb;
  v_i      int := 0;
begin
  -- Use the existing id from JSONB if it looks like a UUID, else generate new
  begin
    v_id := (p_node->>'id')::uuid;
  exception when others then
    v_id := gen_random_uuid();
  end;

  insert into public.family_tree_nodes (
    id, family_id, parent_id,
    name, born, avatar, user_id,
    partner_name, partner_born,
    email, phone, address,
    sort_order
  ) values (
    v_id, p_family_id, p_parent_id,
    coalesce(nullif(trim(p_node->>'name'), ''), 'Member'),
    nullif(trim(coalesce(p_node->>'born', '')), ''),
    nullif(p_node->>'avatar', ''),
    case when p_node->>'userId' ~ '^[0-9a-f-]{36}$'
         then (p_node->>'userId')::uuid else null end,
    nullif(p_node->'partner'->>'name', ''),
    nullif(p_node->'partner'->>'born', ''),
    nullif(p_node->>'email', ''),
    nullif(p_node->>'phone', ''),
    nullif(p_node->>'address', ''),
    p_order
  )
  on conflict (id) do nothing;

  -- Recurse into children
  for v_child in
    select value from jsonb_array_elements(coalesce(p_node->'children', '[]'::jsonb))
  loop
    perform public.migrate_jsonb_node(p_family_id, v_child, v_id, v_i);
    v_i := v_i + 1;
  end loop;

  return v_id;
end;
$$;

-- Run migration for all existing trees
do $$
declare
  r record;
begin
  for r in select family_id, tree_data from public.family_trees where tree_data is not null loop
    perform public.migrate_jsonb_node(r.family_id, r.tree_data, null, 0);
  end loop;
end;
$$;

-- Clean up migration helper
drop function if exists public.migrate_jsonb_node(uuid, jsonb, uuid, int);

-- ── Keep family_trees as read-only backup for one sprint, then drop ───────────
-- TODO: After verifying migration, run: drop table public.family_trees;
