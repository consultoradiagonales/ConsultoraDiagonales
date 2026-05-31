drop policy if exists "Radiografias public read" on public.radiografias;
create policy "Radiografias public read"
on public.radiografias
for select
to anon, authenticated
using (true);

drop policy if exists "Radiografias storage public read" on storage.objects;
create policy "Radiografias storage public read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'radiografias');

drop policy if exists "Contactos anon insert" on public.contactos;
create policy "Contactos anon insert"
on public.contactos
for insert
to anon, authenticated
with check (true);

drop policy if exists "Contactos anon update" on public.contactos;
create policy "Contactos anon update"
on public.contactos
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "PDF downloads anon insert" on public.pdf_downloads;
create policy "PDF downloads anon insert"
on public.pdf_downloads
for insert
to anon, authenticated
with check (true);

drop policy if exists "Visitor profile anon insert" on public.visitor_profiles;
create policy "Visitor profile anon insert"
on public.visitor_profiles
for insert
to anon, authenticated
with check (true);

drop policy if exists "Visitor profile anon update" on public.visitor_profiles;
create policy "Visitor profile anon update"
on public.visitor_profiles
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Visitor events anon insert" on public.visitor_events;
create policy "Visitor events anon insert"
on public.visitor_events
for insert
to anon, authenticated
with check (true);
