alter table public.contactos enable row level security;
alter table public.visitor_profiles enable row level security;
alter table public.visitor_events enable row level security;
alter table public.whatsapp_verifications enable row level security;
alter table public.pdf_downloads enable row level security;
alter table public.admin_upload_events enable row level security;

drop policy if exists "Contactos anon upsert" on public.contactos;
drop policy if exists "Contactos anon insert" on public.contactos;
drop policy if exists "Contactos anon update" on public.contactos;
drop policy if exists "Visitor profile anon upsert" on public.visitor_profiles;
drop policy if exists "Visitor profile anon insert" on public.visitor_profiles;
drop policy if exists "Visitor profile anon update" on public.visitor_profiles;
drop policy if exists "Visitor events anon insert" on public.visitor_events;
drop policy if exists "Whatsapp verification anon insert" on public.whatsapp_verifications;
drop policy if exists "PDF downloads anon insert" on public.pdf_downloads;
drop policy if exists "Admin upload events anon insert" on public.admin_upload_events;

create policy "Contactos authenticated owner read"
on public.contactos
for select
to authenticated
using (auth_user_id = auth.uid());

create policy "Contactos public intake insert"
on public.contactos
for insert
to anon, authenticated
with check (
  visitor_id is not null
  and phone is not null
  and length(regexp_replace(phone, '\D', '', 'g')) between 10 and 15
  and coalesce(consent_terms, false) = true
);

create policy "Contactos authenticated owner update"
on public.contactos
for update
to authenticated
using (auth_user_id = auth.uid() or auth_user_id is null)
with check (auth_user_id = auth.uid());

create policy "Visitor profiles authenticated owner read"
on public.visitor_profiles
for select
to authenticated
using (auth_user_id = auth.uid());

create policy "Visitor profiles public touch insert"
on public.visitor_profiles
for insert
to anon, authenticated
with check (visitor_id is not null);

create policy "Visitor profiles authenticated owner update"
on public.visitor_profiles
for update
to authenticated
using (auth_user_id = auth.uid() or auth_user_id is null)
with check (auth_user_id = auth.uid());

create policy "Visitor events public insert"
on public.visitor_events
for insert
to anon, authenticated
with check (
  visitor_id is not null
  and event_type is not null
  and length(event_type) <= 80
  and coalesce(length(page), 0) <= 120
  and coalesce(length(path), 0) <= 500
);

create policy "PDF downloads authenticated owner read"
on public.pdf_downloads
for select
to authenticated
using (
  exists (
    select 1
    from public.contactos c
    where c.visitor_id = pdf_downloads.visitor_id
      and c.auth_user_id = auth.uid()
  )
);

create policy "PDF downloads public insert"
on public.pdf_downloads
for insert
to anon, authenticated
with check (
  visitor_id is not null
  and radiografia_id is not null
  and coalesce(length(phone), 0) <= 30
  and coalesce(length(email), 0) <= 320
  and coalesce(length(full_name), 0) <= 180
);

create policy "Whatsapp verifications service only read"
on public.whatsapp_verifications
for select
to authenticated
using (false);

create policy "Whatsapp verification public insert"
on public.whatsapp_verifications
for insert
to anon, authenticated
with check (
  visitor_id is not null
  and phone is not null
  and length(regexp_replace(phone, '\D', '', 'g')) between 10 and 15
);

revoke all on function public.store_osint_run(jsonb) from public;
revoke all on function public.store_osint_run(jsonb) from anon;
grant execute on function public.store_osint_run(jsonb) to authenticated;

revoke all on function public.get_osint_history(text) from public;
revoke all on function public.get_osint_history(text) from anon;
grant execute on function public.get_osint_history(text) to authenticated;

revoke insert, update, delete on public.admin_upload_events from anon, authenticated;
