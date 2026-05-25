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
alter table public.radiografias add column if not exists localidad text;
alter table public.radiografias alter column pdf_url drop not null;

create index if not exists radiografias_fecha_idx on public.radiografias (fecha desc);

alter table public.radiografias enable row level security;

create policy "Radiografias public read"
on public.radiografias
for select
to anon
using (true);

create policy "Radiografias anon insert"
on public.radiografias
for insert
to anon
with check (true);

insert into storage.buckets (id, name, public)
values ('radiografias', 'radiografias', true)
on conflict (id) do update set public = true;

create policy "Radiografias storage public read"
on storage.objects
for select
to anon
using (bucket_id = 'radiografias');

create policy "Radiografias storage anon upload"
on storage.objects
for insert
to anon
with check (bucket_id = 'radiografias');

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

create policy "Visitor profile anon upsert"
on public.visitor_profiles
for all
to anon
using (true)
with check (true);

create policy "Visitor events anon insert"
on public.visitor_events
for insert
to anon
with check (true);

create policy "Visitor events anon read"
on public.visitor_events
for select
to anon
using (true);

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
