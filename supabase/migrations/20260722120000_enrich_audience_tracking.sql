alter table public.visitor_events
  add column if not exists client_event_id uuid,
  add column if not exists session_id text,
  add column if not exists referrer text,
  add column if not exists referrer_host text,
  add column if not exists landing_page text,
  add column if not exists traffic_source text,
  add column if not exists traffic_medium text,
  add column if not exists traffic_campaign text,
  add column if not exists traffic_campaign_id text,
  add column if not exists traffic_content text,
  add column if not exists traffic_term text,
  add column if not exists click_id_type text,
  add column if not exists click_id text,
  add column if not exists device_type text,
  add column if not exists browser_name text,
  add column if not exists browser_version text,
  add column if not exists os_name text,
  add column if not exists os_version text,
  add column if not exists language text,
  add column if not exists client_timezone text,
  add column if not exists viewport_width integer,
  add column if not exists viewport_height integer,
  add column if not exists screen_width integer,
  add column if not exists screen_height integer,
  add column if not exists connection_type text,
  add column if not exists connection_downlink numeric,
  add column if not exists is_returning boolean,
  add column if not exists isp text,
  add column if not exists network_org text,
  add column if not exists asn text;

create unique index if not exists visitor_events_client_event_uidx
  on public.visitor_events (client_event_id);

create index if not exists visitor_events_session_created_idx
  on public.visitor_events (session_id, created_at desc)
  where session_id is not null;

create index if not exists visitor_events_source_created_idx
  on public.visitor_events (traffic_source, traffic_medium, created_at desc)
  where traffic_source is not null;

create index if not exists visitor_events_campaign_created_idx
  on public.visitor_events (traffic_campaign, created_at desc)
  where traffic_campaign is not null;

create index if not exists visitor_events_device_created_idx
  on public.visitor_events (device_type, created_at desc)
  where device_type is not null;

comment on column public.visitor_events.session_id is
  'Sesion first-party de 30 minutos de inactividad, generada por el sitio.';

comment on column public.visitor_events.traffic_source is
  'Fuente normalizada desde UTM o referente: google, instagram, whatsapp, directo u otra.';

comment on column public.visitor_events.click_id is
  'Identificador tecnico de clic publicitario recibido en la URL; no es una cuenta personal del visitante.';

comment on column public.visitor_events.is_returning is
  'Indica que el navegador ya habia registrado una sesion first-party anterior.';
