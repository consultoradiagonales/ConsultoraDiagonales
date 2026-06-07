create extension if not exists "pgcrypto";

create table if not exists public.osint_subjects (
  id uuid primary key default gen_random_uuid(),
  subject_type text default 'unknown',
  display_name text,
  normalized_name text,
  primary_identifier text,
  province text,
  metadata jsonb default '{}'::jsonb,
  first_seen_at timestamp with time zone default now(),
  last_seen_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.osint_identifiers (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.osint_subjects(id) on delete cascade,
  identifier_type text not null,
  value text not null,
  normalized_value text not null,
  is_primary boolean default false,
  confidence text default 'media',
  source text default 'system',
  created_at timestamp with time zone default now(),
  unique (identifier_type, normalized_value)
);

create table if not exists public.osint_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text unique not null,
  name text not null,
  category text,
  access_mode text not null default 'automatic',
  base_url text,
  status text default 'active',
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.osint_source_runs (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.osint_subjects(id) on delete set null,
  source_id uuid references public.osint_sources(id) on delete set null,
  module_key text not null,
  status text not null,
  query text,
  summary text,
  started_at timestamp with time zone default now(),
  finished_at timestamp with time zone,
  metadata jsonb default '{}'::jsonb
);

create table if not exists public.osint_observations (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.osint_subjects(id) on delete cascade,
  source_run_id uuid references public.osint_source_runs(id) on delete set null,
  observation_type text not null,
  title text,
  value text,
  normalized_value text,
  confidence text default 'media',
  observed_at timestamp with time zone default now(),
  valid_from date,
  valid_to date,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

create table if not exists public.osint_evidence (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid references public.osint_observations(id) on delete cascade,
  subject_id uuid references public.osint_subjects(id) on delete cascade,
  source_run_id uuid references public.osint_source_runs(id) on delete set null,
  evidence_type text default 'url',
  title text,
  url text,
  content_hash text,
  extracted_text text,
  captured_at timestamp with time zone default now(),
  metadata jsonb default '{}'::jsonb
);

create table if not exists public.osint_relationships (
  id uuid primary key default gen_random_uuid(),
  from_subject_id uuid references public.osint_subjects(id) on delete cascade,
  to_subject_id uuid references public.osint_subjects(id) on delete cascade,
  relationship_type text not null,
  confidence text default 'media',
  source_run_id uuid references public.osint_source_runs(id) on delete set null,
  evidence_id uuid references public.osint_evidence(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  first_seen_at timestamp with time zone default now(),
  last_seen_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

create table if not exists public.osint_reports (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid references public.osint_subjects(id) on delete set null,
  report_type text default 'commercial_osint',
  title text,
  score jsonb default '{}'::jsonb,
  summary text,
  pdf_url text,
  html_snapshot text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

create index if not exists osint_subjects_identifier_idx on public.osint_subjects (primary_identifier);
create index if not exists osint_subjects_name_idx on public.osint_subjects (normalized_name);
create index if not exists osint_identifiers_subject_idx on public.osint_identifiers (subject_id);
create index if not exists osint_identifiers_value_idx on public.osint_identifiers (normalized_value);
create index if not exists osint_source_runs_subject_idx on public.osint_source_runs (subject_id, started_at desc);
create index if not exists osint_observations_subject_idx on public.osint_observations (subject_id, created_at desc);
create index if not exists osint_observations_type_idx on public.osint_observations (observation_type, created_at desc);
create index if not exists osint_evidence_subject_idx on public.osint_evidence (subject_id, captured_at desc);
create index if not exists osint_relationships_from_idx on public.osint_relationships (from_subject_id, relationship_type);
create index if not exists osint_relationships_to_idx on public.osint_relationships (to_subject_id, relationship_type);
create index if not exists osint_reports_subject_idx on public.osint_reports (subject_id, created_at desc);

drop trigger if exists osint_subjects_touch_updated_at on public.osint_subjects;
create trigger osint_subjects_touch_updated_at
before update on public.osint_subjects
for each row
execute function public.touch_updated_at();

drop trigger if exists osint_sources_touch_updated_at on public.osint_sources;
create trigger osint_sources_touch_updated_at
before update on public.osint_sources
for each row
execute function public.touch_updated_at();

alter table public.osint_subjects enable row level security;
alter table public.osint_identifiers enable row level security;
alter table public.osint_sources enable row level security;
alter table public.osint_source_runs enable row level security;
alter table public.osint_observations enable row level security;
alter table public.osint_evidence enable row level security;
alter table public.osint_relationships enable row level security;
alter table public.osint_reports enable row level security;

create policy "OSINT sources public read"
on public.osint_sources
for select
to anon, authenticated
using (true);

insert into public.osint_sources (source_key, name, category, access_mode, base_url)
values
  ('bcra', 'BCRA Central de Deudores', 'financiero', 'semi_automatic', 'https://www.bcra.gob.ar/'),
  ('arca', 'ARCA Constancia de Inscripcion', 'fiscal', 'semi_automatic', 'https://www.arca.gob.ar/'),
  ('anses', 'ANSES Constancia de CUIL', 'identidad_laboral', 'semi_automatic', 'https://www.anses.gob.ar/'),
  ('bora', 'Boletin Oficial de la Republica Argentina', 'boletin_oficial', 'automatic', 'https://www.boletinoficial.gob.ar/'),
  ('dateas', 'Dateas', 'padrones_publicos', 'search', 'https://www.dateas.com/'),
  ('compras', 'Compras.gob.ar', 'contrataciones', 'automatic', 'https://compras.gob.ar/'),
  ('datos', 'Datos.gob.ar', 'datos_abiertos', 'automatic', 'https://www.datos.gob.ar/'),
  ('medios', 'Medios y buscadores', 'medios', 'search', null),
  ('redes', 'Redes y presencia digital', 'redes', 'search', null),
  ('archivo', 'Archivo web', 'archivo', 'search', 'https://web.archive.org/')
on conflict (source_key) do update set
  name = excluded.name,
  category = excluded.category,
  access_mode = excluded.access_mode,
  base_url = excluded.base_url,
  updated_at = now();

