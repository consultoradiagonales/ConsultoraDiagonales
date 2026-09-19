create or replace function public.get_osint_history(p_identifier text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalized text := regexp_replace(coalesce(p_identifier, ''), '\D', '', 'g');
  v_subject_id uuid;
  v_subject jsonb := '{}'::jsonb;
  v_runs jsonb := '[]'::jsonb;
  v_observations jsonb := '[]'::jsonb;
  v_reports jsonb := '[]'::jsonb;
begin
  select s.id into v_subject_id
  from public.osint_subjects s
  left join public.osint_identifiers i on i.subject_id = s.id
  where regexp_replace(coalesce(s.primary_identifier, ''), '\D', '', 'g') = v_normalized
     or i.normalized_value = v_normalized
  order by s.last_seen_at desc
  limit 1;

  if v_subject_id is null then
    return jsonb_build_object(
      'found', false,
      'runsCount', 0,
      'findingsCount', 0,
      'lastRunAt', null,
      'runs', '[]'::jsonb,
      'observations', '[]'::jsonb,
      'reports', '[]'::jsonb
    );
  end if;

  select to_jsonb(s.*) into v_subject
  from public.osint_subjects s
  where s.id = v_subject_id;

  select coalesce(jsonb_agg(to_jsonb(r.*) order by r.started_at desc), '[]'::jsonb)
  into v_runs
  from public.osint_source_runs r
  where r.subject_id = v_subject_id;

  select coalesce(jsonb_agg(to_jsonb(o.*) order by o.created_at desc), '[]'::jsonb)
  into v_observations
  from public.osint_observations o
  where o.subject_id = v_subject_id;

  select coalesce(jsonb_agg(to_jsonb(rep.*) order by rep.created_at desc), '[]'::jsonb)
  into v_reports
  from public.osint_reports rep
  where rep.subject_id = v_subject_id;

  return jsonb_build_object(
    'found', true,
    'subject', v_subject,
    'runsCount', jsonb_array_length(v_runs),
    'findingsCount', jsonb_array_length(v_observations),
    'lastRunAt', v_subject->>'last_seen_at',
    'runs', v_runs,
    'observations', v_observations,
    'reports', v_reports
  );
end;
$$;

revoke all on function public.get_osint_history(text) from public;
grant execute on function public.get_osint_history(text) to anon, authenticated;
