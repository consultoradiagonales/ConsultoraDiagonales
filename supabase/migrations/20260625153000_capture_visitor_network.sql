alter table public.visitor_events
  add column if not exists ip_address text,
  add column if not exists geo_city text,
  add column if not exists geo_region text,
  add column if not exists geo_country text,
  add column if not exists geo_country_code text,
  add column if not exists geo_timezone text,
  add column if not exists capture_method text;

create index if not exists visitor_events_visitor_created_idx
  on public.visitor_events (visitor_id, created_at desc);

create index if not exists visitor_events_ip_created_idx
  on public.visitor_events (ip_address, created_at desc)
  where ip_address is not null;

comment on column public.visitor_events.ip_address is
  'IP observada por la Edge Function. Puede ser IPv4 o IPv6.';

comment on column public.visitor_events.geo_city is
  'Ciudad aproximada inferida por geolocalizacion IP; no representa domicilio exacto.';

comment on column public.visitor_events.geo_region is
  'Provincia, estado o region aproximada inferida por geolocalizacion IP.';
