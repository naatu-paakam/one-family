-- Add partner_user_id to family_tree_nodes so a logged-in user can mark
-- themselves as the partner/spouse of a member (BUG-002).

alter table public.family_tree_nodes
  add column if not exists partner_user_id uuid references public.profiles(id) on delete set null;

create index if not exists family_tree_nodes_partner_user_id_idx
  on public.family_tree_nodes(partner_user_id);
