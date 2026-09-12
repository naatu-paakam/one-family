-- Allow event_id to be NULL so story comments can be inserted (ADR story comments).
-- Previously NOT NULL because comments were event-only; now comments can belong to
-- either an event OR a story (enforced by comments_one_parent CHECK constraint).

alter table public.comments alter column event_id drop not null;
