-- Family-scoped storage RLS for the update-images bucket.
-- Images are stored at {family_id}/{filename}.
-- Only members of that family may upload or read; the shared/ prefix is open.

-- Allow members to upload to their own family's folder
create policy "Family members can upload images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'update-images'
    and (
      -- shared/ prefix: any authenticated user
      (storage.foldername(name))[1] = 'shared'
      -- family folder: caller must be a member of that family
      or (storage.foldername(name))[1]::uuid in (select public.my_family_ids())
    )
  );

-- Allow members to read images from their own family's folder (and shared/)
create policy "Family members can read images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'update-images'
    and (
      (storage.foldername(name))[1] = 'shared'
      or (storage.foldername(name))[1]::uuid in (select public.my_family_ids())
    )
  );
