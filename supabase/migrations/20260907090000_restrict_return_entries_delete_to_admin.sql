-- Restrict deleting a return entry to admins, using the existing shared
-- user_roles/has_role() system. Add/edit stays available to everyone
-- authenticated, matching current app behavior.

drop policy if exists "Allow authenticated full access" on public.return_entries;

create policy "Authenticated can read return entries" on public.return_entries
  for select to authenticated using (true);

create policy "Authenticated can insert return entries" on public.return_entries
  for insert to authenticated with check (true);

create policy "Authenticated can update return entries" on public.return_entries
  for update to authenticated using (true) with check (true);

create policy "Admins can delete return entries" on public.return_entries
  for delete to authenticated using (has_role(auth.uid(), 'admin'::app_role));
