-- Noticias editoriales: contenido HTML-free, imágenes públicas y publicación sin PDF.

alter table public.noticias
  add column if not exists contenido jsonb not null default '[]'::jsonb,
  add column if not exists imagen_alt text,
  add column if not exists imagen_epigrafe text,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists seo_keywords text[] not null default '{}',
  add column if not exists autor text not null default 'Consultora Diagonales',
  add column if not exists lectura_minutos integer;

create index if not exists noticias_fecha_publicacion_idx
  on public.noticias (estado, published_at desc, updated_at desc);

-- El PDF previo sigue disponible para el archivo histórico. Las imágenes de las
-- nuevas notas se publican desde un bucket separado, apto para <img> y redes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'noticias-media',
  'noticias-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
)
on conflict (id) do update
set public = true,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[];

drop policy if exists "Noticias media public read" on storage.objects;
create policy "Noticias media public read"
on storage.objects
for select
to public
using (bucket_id = 'noticias-media');

-- Una publicación ya no depende de un PDF ni de una radiografía. Ambos quedan
-- como vínculos opcionales para conservar el archivo existente.
create or replace function public.publish_noticia(p_noticia_id uuid)
returns public.noticias
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_noticia public.noticias;
begin
  select * into selected_noticia
  from public.noticias
  where id = p_noticia_id
  for update;

  if not found then
    raise exception 'Noticia no encontrada';
  end if;

  if jsonb_typeof(coalesce(selected_noticia.contenido, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(selected_noticia.contenido, '[]'::jsonb)) = 0 then
    raise exception 'La nota necesita contenido antes de publicarse';
  end if;

  if length(btrim(coalesce(selected_noticia.titulo, ''))) < 12
     or length(btrim(coalesce(selected_noticia.subtitulo, ''))) < 40 then
    raise exception 'La nota necesita un titular y una bajada completos antes de publicarse';
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
  set estado = 'archived',
      updated_at = now()
  where estado = 'featured'
    and id <> p_noticia_id;

  if selected_noticia.radiografia_id is not null then
    update public.radiografias
    set publication_state = 'unlisted',
        is_private = false
    where id = selected_noticia.radiografia_id;
  end if;

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
