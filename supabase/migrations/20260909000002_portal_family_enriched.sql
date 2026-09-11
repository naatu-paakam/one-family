-- Enrich portal_fetch_families with creator name and admin member list.
-- Replaces the previous RPC (same name, new return shape).

create or replace function public.portal_fetch_families()
returns table (
  id              uuid,
  name            text,
  invite_code     text,
  created_by      uuid,
  creator_name    text,
  created_at      timestamptz,
  bio             text,
  suspended_at    timestamptz,
  member_count    bigint,
  admins          jsonb     -- [{id, full_name, avatar_url}]
)
language sql security definer stable as $$
  select
    f.id,
    f.name,
    f.invite_code,
    f.created_by,
    creator.full_name   as creator_name,
    f.created_at,
    f.bio,
    f.suspended_at,
    count(fm.id)        as member_count,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',         ap.id,
          'full_name',  ap.full_name,
          'avatar_url', ap.avatar_url
        )
        order by afm.joined_at
      ) filter (where afm.role = 'admin'),
      '[]'::jsonb
    )                   as admins
  from public.families f
  left join public.family_members fm  on fm.family_id = f.id
  left join public.family_members afm on afm.family_id = f.id and afm.role = 'admin'
  left join public.profiles        ap  on ap.id = afm.user_id
  left join public.profiles        creator on creator.id = f.created_by
  where exists (
    select 1 from public.profiles where id = auth.uid() and is_portal_admin = true
  )
  group by f.id, creator.full_name
  order by f.created_at desc;
$$;
