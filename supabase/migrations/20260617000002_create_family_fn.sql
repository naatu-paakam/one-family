-- Atomic create-family function: inserts family + auto-joins creator as admin
-- Runs as security definer so it bypasses RLS during the insert+join sequence.

create or replace function public.create_family(p_name text)
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

  insert into families (name, created_by)
  values (p_name, auth.uid())
  returning * into v_family;

  insert into family_members (family_id, user_id, role)
  values (v_family.id, auth.uid(), 'admin')
  on conflict (family_id, user_id) do nothing;

  return v_family;
end;
$$;
