create extension if not exists "uuid-ossp";

create table if not exists public.radiografias (
  id uuid primary key default uuid_generate_v4(),
  titulo text not null,
  provincia text not null,
  localidad text,
  fecha date not null,
  html_url text,
  pdf_url text,
  created_at timestamp with time zone default now()
);

alter table public.radiografias add column if not exists html_url text;
alter table public.radiografias add column if not exists pdf_url text;
alter table public.radiografias add column if not exists localidad text;
alter table public.radiografias add column if not exists storage_path text;
alter table public.radiografias add column if not exists file_name text;
alter table public.radiografias add column if not exists file_size bigint;
alter table public.radiografias add column if not exists mime_type text;
alter table public.radiografias add column if not exists updated_at timestamp with time zone default now();
alter table public.radiografias alter column pdf_url drop not null;

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
  mime_type = coalesce(mime_type, case when pdf_url is not null then 'application/pdf' else null end),
  updated_at = coalesce(updated_at, created_at, now())
where pdf_url is not null;

create index if not exists radiografias_fecha_idx on public.radiografias (fecha desc);
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

alter table public.radiografias enable row level security;

create policy "Radiografias public read"
on public.radiografias
for select
to anon
using (true);

insert into storage.buckets (id, name, public)
values ('radiografias', 'radiografias', true)
on conflict (id) do update set public = true;

create policy "Radiografias storage public read"
on storage.objects
for select
to anon
using (bucket_id = 'radiografias');

create table if not exists public.visitor_profiles (
  visitor_id uuid primary key,
  email text,
  phone text,
  social_provider text,
  social_user_id text,
  full_name text,
  avatar_url text,
  first_seen_at timestamp with time zone default now(),
  last_seen_at timestamp with time zone default now(),
  visit_count integer default 1,
  lead_score integer default 0,
  tags text[] default '{}'
);

create table if not exists public.visitor_events (
  id uuid primary key default uuid_generate_v4(),
  visitor_id uuid not null,
  event_type text not null,
  page text,
  path text,
  metadata jsonb default '{}'::jsonb,
  user_agent text,
  created_at timestamp with time zone default now()
);

create index if not exists visitor_events_visitor_idx on public.visitor_events (visitor_id, created_at desc);
create index if not exists visitor_events_type_idx on public.visitor_events (event_type, created_at desc);

alter table public.visitor_profiles enable row level security;
alter table public.visitor_events enable row level security;

alter table public.visitor_profiles add column if not exists organization text;
alter table public.visitor_profiles add column if not exists auth_user_id uuid;

create table if not exists public.contactos (
  id uuid primary key default uuid_generate_v4(),
  visitor_id uuid unique not null,
  auth_user_id uuid,
  email text,
  phone text not null,
  full_name text,
  organization text,
  social_provider text,
  social_user_id text,
  avatar_url text,
  access_reason text default 'pdf_download',
  phone_validation_status text default 'pending',
  consent_terms boolean default false,
  tags text[] default '{}',
  first_seen_at timestamp with time zone default now(),
  last_seen_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.whatsapp_verifications (
  id uuid primary key default uuid_generate_v4(),
  visitor_id uuid not null,
  phone text not null,
  code_hash text,
  channel text default 'whatsapp',
  purpose text default 'pdf_download',
  status text default 'pending',
  sent_at timestamp with time zone,
  verified_at timestamp with time zone,
  expires_at timestamp with time zone default now() + interval '10 minutes',
  attempts integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists public.pdf_downloads (
  id uuid primary key default uuid_generate_v4(),
  visitor_id uuid not null,
  contacto_id uuid references public.contactos(id) on delete set null,
  radiografia_id uuid references public.radiografias(id) on delete set null,
  pdf_url text,
  email text,
  phone text,
  full_name text,
  lugar text,
  provincia text,
  localidad text,
  user_agent text,
  downloaded_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

create table if not exists public.admin_upload_events (
  id uuid primary key default uuid_generate_v4(),
  titulo text,
  provincia text,
  localidad text,
  html_url text,
  pdf_url text,
  uploaded_by text,
  user_agent text,
  created_at timestamp with time zone default now()
);

alter table public.pdf_downloads add column if not exists email text;
alter table public.pdf_downloads add column if not exists phone text;
alter table public.pdf_downloads add column if not exists full_name text;
alter table public.pdf_downloads add column if not exists lugar text;
alter table public.pdf_downloads add column if not exists provincia text;
alter table public.pdf_downloads add column if not exists localidad text;
alter table public.pdf_downloads add column if not exists user_agent text;
alter table public.pdf_downloads add column if not exists downloaded_at timestamp with time zone default now();
alter table public.admin_upload_events add column if not exists pdf_url text;
alter table public.admin_upload_events add column if not exists radiografia_id uuid references public.radiografias(id) on delete set null;
alter table public.admin_upload_events add column if not exists action text;
alter table public.admin_upload_events add column if not exists storage_path text;
alter table public.admin_upload_events add column if not exists file_name text;
alter table public.admin_upload_events add column if not exists metadata jsonb default '{}'::jsonb;

create index if not exists contactos_phone_idx on public.contactos (phone);
create index if not exists contactos_email_idx on public.contactos (email);
create index if not exists whatsapp_verifications_phone_idx on public.whatsapp_verifications (phone, created_at desc);
create index if not exists pdf_downloads_visitor_idx on public.pdf_downloads (visitor_id, created_at desc);
create index if not exists pdf_downloads_radiografia_idx on public.pdf_downloads (radiografia_id, created_at desc);
create index if not exists pdf_downloads_lugar_idx on public.pdf_downloads (lugar, created_at desc);
create index if not exists admin_upload_events_radiografia_idx on public.admin_upload_events (radiografia_id, created_at desc);
create index if not exists admin_upload_events_action_idx on public.admin_upload_events (action, created_at desc);

alter table public.contactos enable row level security;
alter table public.whatsapp_verifications enable row level security;
alter table public.pdf_downloads enable row level security;
alter table public.admin_upload_events enable row level security;

drop policy if exists "Contactos anon upsert" on public.contactos;

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

create policy "Whatsapp verification anon insert"
on public.whatsapp_verifications
for insert
to anon
with check (true);

create policy "PDF downloads anon insert"
on public.pdf_downloads
for insert
to anon
with check (true);

create policy "Admin upload events anon insert"
on public.admin_upload_events
for insert
to anon
with check (true);

drop policy if exists "Visitor profile anon upsert" on public.visitor_profiles;

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

create policy "Visitor events anon insert"
on public.visitor_events
for insert
to anon
with check (true);

drop policy if exists "Visitor events anon read" on public.visitor_events;

create or replace function public.register_visitor_touch(p_visitor_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.visitor_profiles (visitor_id, first_seen_at, last_seen_at, visit_count)
  values (p_visitor_id, now(), now(), 1)
  on conflict (visitor_id)
  do update set
    last_seen_at = now(),
    visit_count = public.visitor_profiles.visit_count + 1;
end;
$$;

create or replace view public.visitor_activity_summary as
select
  p.visitor_id,
  p.email,
  p.phone,
  p.social_provider,
  p.organization,
  p.auth_user_id,
  p.full_name,
  p.first_seen_at,
  p.last_seen_at,
  p.visit_count,
  p.lead_score,
  p.tags,
  count(e.id) as total_events,
  count(*) filter (where e.event_type = 'page_view') as page_views,
  count(*) filter (where e.event_type = 'download_report') as downloads,
  count(*) filter (where e.event_type = 'request_pdf') as pdf_requests,
  max((e.metadata->>'seconds')::int) filter (where e.event_type = 'read_session') as max_read_seconds,
  max((e.metadata->>'scroll_depth')::int) filter (where e.event_type = 'read_session') as max_scroll_depth
from public.visitor_profiles p
left join public.visitor_events e on e.visitor_id = p.visitor_id
group by p.visitor_id;

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
