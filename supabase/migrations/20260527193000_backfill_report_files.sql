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
