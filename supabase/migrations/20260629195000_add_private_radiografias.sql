alter table public.radiografias
  add column if not exists is_private boolean not null default false;

create index if not exists radiografias_is_private_idx on public.radiografias (is_private, fecha desc);
