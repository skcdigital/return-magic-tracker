-- Security fix: the return-attachments bucket was public, and had a
-- "Public can read return attachments" policy allowing anyone on the
-- internet to list and download every uploaded RFC/GRS/GRN document and
-- supplier credit document without logging in. Restrict reads to
-- authenticated users only, matching how the app already requires login
-- for everything else.

update storage.buckets set public = false where id = 'return-attachments';

drop policy if exists "Public can read return attachments" on storage.objects;
create policy "Authenticated can read return attachments" on storage.objects
  for select to authenticated
  using (bucket_id = 'return-attachments');
