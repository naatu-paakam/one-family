-- ── Comments on events ───────────────────────────────────────────────────────

create table if not exists comments (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  author_id   uuid references profiles(id) on delete set null,
  family_id   uuid not null references families(id) on delete cascade,
  content     text,
  image_url   text,
  parent_id   uuid references comments(id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table comments enable row level security;

create policy "Comments readable by family members"
  on comments for select
  using (
    family_id in (
      select family_id from family_members where user_id = auth.uid()
    )
  );

create policy "Authenticated users can insert comments"
  on comments for insert
  with check (auth.uid() is not null);

create policy "Authors can delete their own comments"
  on comments for delete
  using (author_id = auth.uid());

-- ── Comment reactions (emoji, one per user per emoji per comment) ─────────────

create table if not exists comment_reactions (
  comment_id  uuid not null references comments(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  emoji       text not null,
  primary key (comment_id, user_id, emoji)
);

alter table comment_reactions enable row level security;

create policy "Reactions readable by family members"
  on comment_reactions for select
  using (
    comment_id in (
      select id from comments
      where family_id in (
        select family_id from family_members where user_id = auth.uid()
      )
    )
  );

create policy "Authenticated users can react"
  on comment_reactions for insert
  with check (auth.uid() = user_id);

create policy "Users can remove their own reactions"
  on comment_reactions for delete
  using (auth.uid() = user_id);
