# ADR-012 — Family tree scale: flat node rows + lazy-load

**Status:** Accepted  
**Date:** 2026-09-11  
**Deciders:** Pavan Kumar Bijjala

---

## Context

Family Vibes must support family trees of 200–300 nodes on average, with some families reaching 1000+ nodes.

The current implementation stores the entire tree as a single nested JSONB blob in `family_trees(family_id, tree_data jsonb)`. This design breaks at scale in three ways:

1. **Rendering:** React renders all N nodes on load. At 1000 nodes this causes visible lag.
2. **Saving:** Any edit saves the entire JSONB blob (~500KB for 1000 nodes), debounced at 800ms. Wasteful and slow on poor connections.
3. **Concurrent editing:** Two family members editing different branches simultaneously — last write wins, silently losing the other person's changes.

A fourth practical issue: with a flat JSONB blob, you cannot search for a member by name in SQL, and the client must traverse the entire tree to find any node.

---

## Decision

### 1. Replace JSONB blob with a flat `family_tree_nodes` table

Each member is a row. The tree structure is expressed via `parent_id` (adjacency list).

```sql
create table family_tree_nodes (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families(id) on delete cascade,
  parent_id   uuid references family_tree_nodes(id) on delete cascade,

  -- Core identity
  name        text not null,
  born        text,
  avatar      text,
  user_id     uuid references profiles(id) on delete set null,

  -- Partner / spouse (Option A — ADR TBD)
  partner_name text,
  partner_born text,

  -- Contact (private — always family-members-only per ADR-010)
  email       text,
  phone       text,
  address     text,

  -- Sibling ordering within a parent
  sort_order  int not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Indexes
create index on family_tree_nodes(family_id);
create index on family_tree_nodes(parent_id);
create index on family_tree_nodes(user_id);
-- Full-text search on name
create index on family_tree_nodes using gin(to_tsvector('simple', name));
```

### 2. Operations

| Operation | Old (JSONB) | New (flat rows) |
|---|---|---|
| Load tree | Read 1 row (~500KB) | SELECT all rows for family (~50KB, faster parse) |
| Add member | Replace entire JSONB | INSERT 1 row |
| Edit member | Replace entire JSONB | UPDATE 1 row |
| Delete member | Replace entire JSONB | DELETE 1 row (cascades to children) |
| Move branch | Replace entire JSONB | UPDATE parent_id on 1 row |
| Concurrent edit | Last write wins (data loss) | Row-level locking — no conflict |
| Search by name | Client traversal, O(n) | `WHERE name ILIKE '%query%'` or full-text index |

### 3. RLS

```sql
alter table family_tree_nodes enable row level security;

-- Members of the family can read all nodes
create policy "Family members can view tree nodes"
  on family_tree_nodes for select
  using (family_id in (select public.my_family_ids()));

-- Members can insert, update, delete their family's nodes
create policy "Family members can edit tree nodes"
  on family_tree_nodes for insert
  with check (family_id in (select public.my_family_ids()));

create policy "Family members can update tree nodes"
  on family_tree_nodes for update
  using (family_id in (select public.my_family_ids()));

create policy "Family members can delete tree nodes"
  on family_tree_nodes for delete
  using (family_id in (select public.my_family_ids()));
```

### 4. Migration of existing JSONB trees

A one-time migration converts every existing `family_trees.tree_data` JSONB blob into flat rows. The migration is a PL/pgSQL function that recursively walks the JSONB tree and inserts rows.

```sql
-- Pseudocode — full migration in migration file
create or replace function migrate_tree_to_nodes(p_family_id uuid, p_node jsonb, p_parent_id uuid, p_order int)
returns uuid language plpgsql as $$
declare
  v_id uuid := (p_node->>'id')::uuid;
  v_child jsonb;
  v_i int := 0;
begin
  insert into family_tree_nodes (id, family_id, parent_id, name, born, sort_order)
  values (
    coalesce(v_id, gen_random_uuid()),
    p_family_id, p_parent_id,
    p_node->>'name',
    p_node->>'born',
    p_order
  );
  for v_child in select * from jsonb_array_elements(coalesce(p_node->'children', '[]'::jsonb))
  loop
    perform migrate_tree_to_nodes(p_family_id, v_child, v_id, v_i);
    v_i := v_i + 1;
  end loop;
  return v_id;
end;
$$;
```

After migration, `family_trees` table is dropped.

### 5. Client-side tree reconstruction

After loading flat rows, the client reconstructs the tree in memory:

```ts
function buildTree(nodes: FlatNode[]): Member | null {
  const map = new Map(nodes.map(n => [n.id, { ...n, children: [] as Member[] }]));
  let root: Member | null = null;
  for (const node of nodes) {
    if (!node.parent_id) { root = map.get(node.id)!; }
    else { map.get(node.parent_id)?.children.push(map.get(node.id)!); }
  }
  // Sort children by sort_order
  for (const node of map.values()) {
    node.children.sort((a, b) => a.sort_order - b.sort_order);
  }
  return root;
}
```

### 6. Lazy-load — collapse by default

All nodes beyond depth 1 (direct children of root) start collapsed. The user expands branches on demand. Controls added:

- **Expand all** / **Collapse all** buttons
- Individual chevron per node (already implemented)
- **Search box** — filters tree to matching nodes, auto-expands their path

### 7. Member search

Client-side (loaded nodes already in memory):

```ts
function searchTree(root: Member, query: string): Set<string> {
  // Returns IDs of matching nodes AND all their ancestors (to keep path visible)
  const matches = new Set<string>();
  const walk = (node: Member, ancestors: string[]) => {
    const hit = node.name.toLowerCase().includes(query.toLowerCase());
    if (hit) { ancestors.forEach(id => matches.add(id)); matches.add(node.id); }
    for (const child of node.children ?? []) walk(child, [...ancestors, node.id]);
  };
  walk(root, []);
  return matches;
}
```

When a query is active: only nodes in `matches` are visible; their ancestors are expanded and non-matching siblings are hidden.

---

## Schema comparison

| | Before | After |
|---|---|---|
| Storage | 1 row per family (JSONB blob) | N rows per family (one per member) |
| Save on edit | Full tree write | Single row UPDATE |
| Load | 1 DB call, large payload | 1 DB call, lightweight rows |
| Concurrent edits | Last write wins | Row-level safe |
| Member search | Client O(n) traversal | SQL + client filter |
| Max comfortable size | ~200 nodes | 1000+ nodes |

---

## Consequences

- **Breaking migration**: `family_trees` table dropped; all existing tree data migrated to `family_tree_nodes`.
- **`supabase.ts`**: `fetchFamilyTree` / `saveFamilyTree` replaced with `fetchFamilyTreeNodes` / CRUD node functions.
- **`FamilyTree` page**: auto-save changes from full-tree debounce to per-node save on explicit "Save" click (or immediate save per edit).
- **`Member` type**: contact fields (`email`, `phone`, `address`, `partner_name`, `partner_born`) become top-level typed columns, not freeform JSONB.
- **Collapse behaviour**: default `expanded = depth <= 1` instead of `true`.
- **Old `family_trees` table**: kept for 1 sprint after migration as backup, then dropped.
- **Tests**: all TC-TREE-* tests updated for new schema and search/collapse features.
