-- Atomic join-family-by-invite-code function.
-- Runs as security definer so it can look up a family by invite_code
-- even before the caller is a member (bypasses the SELECT RLS on families).

create or replace function public.join_family_by_code(p_invite_code text)
returns families
language plpgsql
security definer
as $$
declare
  v_family families;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_family
  from families
  where invite_code = lower(trim(p_invite_code));

  if not found then
    raise exception 'Invalid invite code';
  end if;

  insert into family_members (family_id, user_id, role)
  values (v_family.id, auth.uid(), 'member')
  on conflict (family_id, user_id) do nothing;

  return v_family;
end;
$$;
