create extension if not exists "uuid-ossp";

alter table public.radiografias
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists file_size bigint,
  add column if not exists mime_type text,
  add column if not exists updated_at timestamp with time zone default now();

update public.radiografias
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

update public.radiografias
set
  storage_path = coalesce(
    storage_path,
    nullif(split_part(pdf_url, '/storage/v1/object/public/radiografias/', 2), '')
  ),
  file_name = coalesce(
    file_name,
    nullif(regexp_replace(split_part(pdf_url, '/storage/v1/object/public/radiografias/', 2), '^.*/', ''), '')
  ),
  mime_type = coalesce(mime_type, case when pdf_url is not null then 'application/pdf' else null end)
where pdf_url is not null;

create index if not exists radiografias_created_idx on public.radiografias (created_at desc);
create index if not exists radiografias_storage_path_idx on public.radiografias (storage_path);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists radiografias_touch_updated_at on public.radiografias;
create trigger radiografias_touch_updated_at
before update on public.radiografias
for each row
execute function public.touch_updated_at();

alter table public.admin_upload_events
  add column if not exists radiografia_id uuid references public.radiografias(id) on delete set null,
  add column if not exists action text,
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists metadata jsonb default '{}'::jsonb;

create index if not exists admin_upload_events_radiografia_idx on public.admin_upload_events (radiografia_id, created_at desc);
create index if not exists admin_upload_events_action_idx on public.admin_upload_events (action, created_at desc);

drop view if exists public.pdf_download_metrics;
create or replace view public.pdf_download_metrics as
select
  d.radiografia_id,
  coalesce(r.titulo, 'PDF sin radiografia vinculada') as titulo,
  d.lugar,
  d.provincia,
  d.localidad,
  date_trunc('day', coalesce(d.downloaded_at, d.created_at)) as dia,
  count(*) as descargas,
  count(distinct d.visitor_id) as usuarios_unicos,
  count(distinct d.phone) filter (where d.phone is not null) as telefonos_unicos,
  max(coalesce(d.downloaded_at, d.created_at)) as ultima_descarga
from public.pdf_downloads d
left join public.radiografias r on r.id = d.radiografia_id
group by d.radiografia_id, r.titulo, d.lugar, d.provincia, d.localidad, date_trunc('day', coalesce(d.downloaded_at, d.created_at));

drop policy if exists "Contactos anon upsert" on public.contactos;
drop policy if exists "Visitor profile anon upsert" on public.visitor_profiles;
drop policy if exists "Visitor events anon read" on public.visitor_events;

create policy "Contactos anon insert"
on public.contactos
for insert
to anon
with check (true);

create policy "Contactos anon update"
on public.contactos
for update
to anon
using (true)
with check (true);

create policy "Visitor profile anon insert"
on public.visitor_profiles
for insert
to anon
with check (true);

create policy "Visitor profile anon update"
on public.visitor_profiles
for update
to anon
using (true)
with check (true);
