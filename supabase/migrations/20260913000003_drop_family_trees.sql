-- ADR-012: family_tree_nodes is the canonical store. family_trees JSONB blob is no longer used.
drop table if exists public.family_trees;
