-- Flujo editorial: el informe vigente queda accesible desde su nota y el
-- informe anterior pasa al repositorio público cuando se publica el siguiente.

alter table public.radiografias
  add column if not exists publication_state text not null default 'public';

alter table public.radiografias
  drop constraint if exists radiografias_publication_state_check;

alter table public.radiografias
  add constraint radiografias_publication_state_check
  check (publication_state in ('draft', 'unlisted', 'public'));

create index if not exists radiografias_publication_state_fecha_idx
  on public.radiografias (publication_state, fecha desc, created_at desc);

update storage.buckets
set public = false
where id = 'radiografias';

create table if not exists public.noticias (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  subtitulo text,
  seccion text not null default 'Política',
  url text not null default 'pdf-nota',
  imagen_url text,
  hashtags text[] default '{}',
  fecha date default current_date,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.noticias
  add column if not exists slug text,
  add column if not exists cuerpo text,
  add column if not exists source_url text,
  add column if not exists radiografia_id uuid references public.radiografias(id) on delete set null,
  add column if not exists estado text not null default 'draft',
  add column if not exists published_at timestamp with time zone,
  add column if not exists pdf_url text,
  add column if not exists pdf_storage_path text,
  add column if not exists pdf_file_name text;

insert into storage.buckets (id, name, public)
values ('noticias', 'noticias', false)
on conflict (id) do update set public = false;

update public.noticias
set slug = concat('noticia-', replace(id::text, '-', ''))
where slug is null or btrim(slug) = '';

update public.noticias
set estado = 'archived',
    published_at = coalesce(published_at, created_at, now())
where estado is null or estado = 'draft';

alter table public.noticias
  alter column slug set not null;

alter table public.noticias
  drop constraint if exists noticias_estado_check;

alter table public.noticias
  add constraint noticias_estado_check
  check (estado in ('draft', 'featured', 'archived'));

create unique index if not exists noticias_slug_uidx on public.noticias (slug);
create index if not exists noticias_estado_publicacion_idx
  on public.noticias (estado, published_at desc, fecha desc);
create index if not exists noticias_radiografia_idx on public.noticias (radiografia_id);

alter table public.radiografias enable row level security;
alter table public.noticias enable row level security;

drop policy if exists "Radiografias public read" on public.radiografias;
create policy "Radiografias public read"
on public.radiografias
for select
to anon, authenticated
using (publication_state = 'public');

drop policy if exists "Noticias public read" on public.noticias;
create policy "Noticias public read"
on public.noticias
for select
to anon, authenticated
using (estado in ('featured', 'archived'));

create or replace function public.publish_noticia(p_noticia_id uuid)
returns public.noticias
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_noticia public.noticias;
  selected_radiografia public.radiografias;
begin
  select * into selected_noticia
  from public.noticias
  where id = p_noticia_id
  for update;

  if not found then
    raise exception 'Noticia no encontrada';
  end if;

  if selected_noticia.radiografia_id is null then
    raise exception 'La noticia debe vincular una radiografía';
  end if;

  if selected_noticia.pdf_url is null then
    raise exception 'La noticia debe incluir el PDF periodístico';
  end if;

  select * into selected_radiografia
  from public.radiografias
  where id = selected_noticia.radiografia_id
  for update;

  if not found or selected_radiografia.pdf_url is null or selected_radiografia.html_url is null then
    raise exception 'La radiografía debe incluir PDF y HTML de gráficos';
  end if;

  update public.radiografias
  set publication_state = 'public'
  where id in (
    select radiografia_id
    from public.noticias
    where estado = 'featured'
      and id <> p_noticia_id
      and radiografia_id is not null
  );

  update public.noticias
  set estado = 'archived'
  where estado = 'featured'
    and id <> p_noticia_id;

  update public.radiografias
  set publication_state = 'unlisted',
      is_private = false
  where id = selected_noticia.radiografia_id;

  update public.noticias
  set estado = 'featured',
      published_at = coalesce(published_at, now()),
      updated_at = now()
  where id = p_noticia_id
  returning * into selected_noticia;

  return selected_noticia;
end;
$$;

revoke all on function public.publish_noticia(uuid) from public;
grant execute on function public.publish_noticia(uuid) to service_role;
