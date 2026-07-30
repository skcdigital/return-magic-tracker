-- Audit trail: log every insert/update/delete on return_entries
create table if not exists public.return_entries_audit (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null,
  action text not null check (action in ('insert','update','delete')),
  changed_by uuid,
  changed_by_email text,
  old_data jsonb,
  new_data jsonb,
  changed_at timestamptz not null default now()
);

create index if not exists return_entries_audit_entry_id_idx
  on public.return_entries_audit (entry_id, changed_at desc);

alter table public.return_entries_audit enable row level security;

drop policy if exists "Authenticated can view audit log" on public.return_entries_audit;
create policy "Authenticated can view audit log" on public.return_entries_audit
  for select to authenticated using (true);

create or replace function public.log_return_entries_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.return_entries_audit(entry_id, action, changed_by, changed_by_email, new_data)
    values (NEW.id, 'insert', auth.uid(), auth.jwt() ->> 'email', to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'UPDATE' then
    insert into public.return_entries_audit(entry_id, action, changed_by, changed_by_email, old_data, new_data)
    values (NEW.id, 'update', auth.uid(), auth.jwt() ->> 'email', to_jsonb(OLD), to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into public.return_entries_audit(entry_id, action, changed_by, changed_by_email, old_data)
    values (OLD.id, 'delete', auth.uid(), auth.jwt() ->> 'email', to_jsonb(OLD));
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists return_entries_audit_trigger on public.return_entries;
create trigger return_entries_audit_trigger
  after insert or update or delete on public.return_entries
  for each row execute function public.log_return_entries_change();

-- Attachments: storage bucket + policies for return document images
insert into storage.buckets (id, name, public)
values ('return-attachments', 'return-attachments', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated can upload return attachments" on storage.objects;
create policy "Authenticated can upload return attachments" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'return-attachments');

drop policy if exists "Authenticated can update return attachments" on storage.objects;
create policy "Authenticated can update return attachments" on storage.objects
  for update to authenticated
  using (bucket_id = 'return-attachments');

drop policy if exists "Authenticated can delete return attachments" on storage.objects;
create policy "Authenticated can delete return attachments" on storage.objects
  for delete to authenticated
  using (bucket_id = 'return-attachments');

drop policy if exists "Public can read return attachments" on storage.objects;
create policy "Public can read return attachments" on storage.objects
  for select to public
  using (bucket_id = 'return-attachments');