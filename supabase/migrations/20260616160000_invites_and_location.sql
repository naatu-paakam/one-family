-- Add location field to events
alter table events add column if not exists location text;

-- Invites table for event RSVP management
create table if not exists invites (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  full_name   text not null,
  email       text,
  status      text not null default 'invited',
  invited_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table invites enable row level security;
create policy "Invites viewable by everyone"       on invites for select using (true);
create policy "Logged-in users can add invites"    on invites for insert with check (auth.uid() is not null);
create policy "Logged-in users can update invites" on invites for update using (auth.uid() is not null);
create policy "Logged-in users can delete invites" on invites for delete using (auth.uid() is not null);
