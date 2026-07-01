update storage.buckets
set public = false
where id = 'radiografias';

drop policy if exists "Radiografias storage public read" on storage.objects;
