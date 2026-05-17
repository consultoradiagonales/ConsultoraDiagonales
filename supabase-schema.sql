create extension if not exists "uuid-ossp";

create table if not exists public.radiografias (
  id uuid primary key default uuid_generate_v4(),
  titulo text not null,
  provincia text not null,
  fecha date not null,
  pdf_url text not null,
  created_at timestamp with time zone default now()
);

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
