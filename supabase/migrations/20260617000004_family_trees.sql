-- Stores one family tree per family as a JSON blob.
-- Simpler than a node-per-row approach for family-sized trees.

create table if not exists family_trees (
  family_id  uuid primary key references families(id) on delete cascade,
  tree_data  jsonb not null,
  updated_at timestamptz not null default now()
);

alter table family_trees enable row level security;

-- Members can read their family's tree
create policy "Family members can view family tree"
  on family_trees for select
  using (family_id in (select public.my_family_ids()));

-- Members can insert a new tree for their family
create policy "Family members can create family tree"
  on family_trees for insert
  with check (family_id in (select public.my_family_ids()));

-- Members can update their family's tree
create policy "Family members can update family tree"
  on family_trees for update
  using (family_id in (select public.my_family_ids()))
  with check (family_id in (select public.my_family_ids()));
