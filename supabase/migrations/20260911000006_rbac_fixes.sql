-- RBAC hardening based on matrix review.
-- 1. family_members SELECT: members can see all co-members (not just own row)
-- 2. family_members INSERT: restrict direct inserts — all joins go through RPCs
-- 3. family_members DELETE: family admins can remove members (not just self-leave)
-- 4. comments DELETE: family admins can moderate comments in their events

-- ── family_members SELECT ─────────────────────────────────────────────────────

drop policy if exists "Users can view own memberships" on public.family_members;

create policy "Family members can view co-members"
  on public.family_members for select
  using (
    -- own row always visible
    auth.uid() = user_id
    -- or: any member of the same family can see all other members (ADR-010 invariant: private to family)
    or family_id in (select public.my_family_ids())
  );

-- ── family_members INSERT ─────────────────────────────────────────────────────
-- All legitimate joins go through security-definer RPCs (join_family_by_code,
-- join_family_by_token, create_family). A direct INSERT must be portal-admin only.

drop policy if exists "Authenticated users can join families" on public.family_members;

create policy "Portal admin or RPC can insert family members"
  on public.family_members for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_portal_admin = true)
  );

-- ── family_members DELETE ─────────────────────────────────────────────────────

drop policy if exists "Users can leave a family" on public.family_members;

create policy "Users can leave or admins can remove from family"
  on public.family_members for delete
  using (
    -- own membership (voluntary leave)
    auth.uid() = user_id
    -- family admin removing any member from their family
    or exists (
      select 1 from public.family_members fm
      where fm.family_id = family_members.family_id
        and fm.user_id = auth.uid()
        and fm.role = 'admin'
    )
    -- portal admin can remove anyone from anywhere
    or exists (select 1 from public.profiles where id = auth.uid() and is_portal_admin = true)
  );

-- ── comments DELETE ───────────────────────────────────────────────────────────

drop policy if exists "Authors can delete their own comments" on public.comments;

create policy "Authors or family admins can delete comments"
  on public.comments for delete
  using (
    -- comment author
    author_id = auth.uid()
    -- family admin of the event's owning family
    or exists (
      select 1 from public.events e
      join public.event_families ef on ef.event_id = e.id
      join public.family_members fm on fm.family_id = ef.family_id
      where e.id = comments.event_id
        and fm.user_id = auth.uid()
        and fm.role = 'admin'
    )
    -- portal admin
    or exists (select 1 from public.profiles where id = auth.uid() and is_portal_admin = true)
  );
