-- ─────────────────────────────────────────────────────────────────────────────
-- NaatuPaakam — Supabase Database Schema
-- Run this in the Supabase SQL Editor after creating a new project.
-- ─────────────────────────────────────────────────────────────────────────────

-- Extensions
create extension if not exists "uuid-ossp";

-- ── Profiles (extends auth.users) ────────────────────────────────────────────
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  avatar_url  text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Auto-create profile on new user sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Updates (family news posts) ───────────────────────────────────────────────
create table if not exists updates (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  content      text,
  image_url    text,
  hashtags     text[] not null default '{}',
  author_id    uuid references profiles(id) on delete set null,
  ai_generated boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Keep updated_at current
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists updates_touch_updated_at on updates;
create trigger updates_touch_updated_at
  before update on updates
  for each row execute procedure public.touch_updated_at();

-- ── Summaries (AI-generated weekly summaries) ─────────────────────────────────
create table if not exists summaries (
  id         uuid primary key default gen_random_uuid(),
  content    text not null,
  created_at timestamptz not null default now()
);

-- ── Storage bucket for update images ─────────────────────────────────────────
-- Run in the Supabase dashboard → Storage → New bucket: "update-images" (public)
-- Or via the Supabase CLI:
--   supabase storage create update-images --public

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table profiles enable row level security;
alter table updates  enable row level security;
alter table summaries enable row level security;

-- Profiles
create policy "Public profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

-- Updates
create policy "Updates are publicly readable"
  on updates for select using (true);

-- Any authenticated user can post
create policy "Authenticated users can insert updates"
  on updates for insert
  with check (auth.uid() is not null);

-- Authors can edit their own posts; admins can edit any
create policy "Authors can update their own updates"
  on updates for update
  using (author_id = auth.uid());

create policy "Admins can update any update"
  on updates for update
  using (exists (select 1 from profiles where id = auth.uid() and is_admin));

-- Authors can delete their own posts; admins can delete any
create policy "Authors can delete their own updates"
  on updates for delete
  using (author_id = auth.uid());

create policy "Admins can delete any update"
  on updates for delete
  using (exists (select 1 from profiles where id = auth.uid() and is_admin));

-- Summaries: anyone can read; only admins can insert
create policy "Summaries are publicly readable"
  on summaries for select using (true);

create policy "Admins can insert summaries"
  on summaries for insert
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));

-- Storage: images are publicly readable; any authenticated user can upload
-- In Supabase Dashboard → Storage → update-images → Policies, add:
--   INSERT policy: (auth.uid() is not null)
--   SELECT policy: true  (already public bucket)

-- ── Grant your first admin ────────────────────────────────────────────────────
-- After the admin user logs in for the first time, run:
--   update profiles set is_admin = true where id = '<user-uuid>';
-- Or use the Supabase Table Editor to toggle is_admin = true.
