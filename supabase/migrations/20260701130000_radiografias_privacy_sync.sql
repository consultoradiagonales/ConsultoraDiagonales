alter table public.radiografias
  add column if not exists is_private boolean not null default false;

create index if not exists radiografias_is_private_idx on public.radiografias (is_private, fecha desc);

update public.radiografias
set
  provincia = btrim(regexp_replace(coalesce(provincia, ''), '\s*\[\[CD_PRIVATE\]\]\s*', ' ', 'gi')),
  localidad = nullif(btrim(regexp_replace(coalesce(localidad, ''), '\s*\[\[CD_PRIVATE\]\]\s*', ' ', 'gi')), '')
where provincia ilike '%[[CD_PRIVATE]]%'
   or localidad ilike '%[[CD_PRIVATE]]%';
