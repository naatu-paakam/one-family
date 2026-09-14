-- Free-text duration field on events (e.g. "2 hours", "all day", "30 min")
alter table public.events add column if not exists duration text;
