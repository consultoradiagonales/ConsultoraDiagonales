create or replace function public.store_osint_run(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject jsonb := coalesce(p_payload->'subject', '{}'::jsonb);
  v_history jsonb := coalesce(p_payload->'history', '{}'::jsonb);
  v_score jsonb := coalesce(p_payload->'score', '{}'::jsonb);
  v_subject_id uuid;
  v_identifier text := nullif(v_subject->>'identifier', '');
  v_primary_identifier text := nullif(coalesce(
    v_subject->'variants'->>0,
    v_subject->>'numeric',
    v_subject->>'identifier'
  ), '');
  v_display_name text := nullif(v_subject->>'name', '');
  v_source_run_id uuid;
  v_observation_id uuid;
  v_module jsonb;
  v_finding jsonb;
  v_source_id uuid;
begin
  insert into public.osint_subjects (
    subject_type,
    display_name,
    normalized_name,
    primary_identifier,
    province,
    metadata,
    first_seen_at,
    last_seen_at
  )
  values (
    coalesce(p_payload->'researchPlan'->>'targetType', 'unknown'),
    v_display_name,
    lower(v_display_name),
    v_primary_identifier,
    nullif(p_payload->'researchPlan'->>'jurisdiction', ''),
    jsonb_build_object(
      'derived_dni', v_subject->>'derivedDni',
      'terms', coalesce(v_subject->'terms', '[]'::jsonb),
      'history', v_history
    ),
    now(),
    now()
  )
  on conflict do nothing
  returning id into v_subject_id;

  if v_subject_id is null then
    select id into v_subject_id
    from public.osint_subjects
    where primary_identifier = v_primary_identifier
       or (v_display_name is not null and normalized_name = lower(v_display_name))
    order by created_at asc
    limit 1;
  end if;

  if v_subject_id is not null then
    update public.osint_subjects
    set
      last_seen_at = now(),
      display_name = coalesce(display_name, v_display_name),
      normalized_name = coalesce(normalized_name, lower(v_display_name)),
      primary_identifier = coalesce(primary_identifier, v_primary_identifier),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'derived_dni', v_subject->>'derivedDni',
        'terms', coalesce(v_subject->'terms', '[]'::jsonb)
      )
    where id = v_subject_id;
  end if;

  if v_subject_id is not null and v_primary_identifier is not null then
    insert into public.osint_identifiers (
      subject_id,
      identifier_type,
      value,
      normalized_value,
      is_primary,
      confidence,
      source
    )
    values (
      v_subject_id,
      case when length(regexp_replace(v_primary_identifier, '\D', '', 'g')) = 11 then 'cuit_cuil' else 'identifier' end,
      v_primary_identifier,
      regexp_replace(v_primary_identifier, '\D', '', 'g'),
      true,
      'alta',
      'system'
    )
    on conflict (identifier_type, normalized_value) do nothing;
  end if;

  if v_subject_id is not null and nullif(v_subject->>'derivedDni', '') is not null then
    insert into public.osint_identifiers (
      subject_id,
      identifier_type,
      value,
      normalized_value,
      is_primary,
      confidence,
      source
    )
    values (
      v_subject_id,
      'dni',
      v_subject->>'derivedDni',
      regexp_replace(v_subject->>'derivedDni', '\D', '', 'g'),
      false,
      'alta',
      'system'
    )
    on conflict (identifier_type, normalized_value) do nothing;
  end if;

  for v_module in select * from jsonb_array_elements(coalesce(p_payload->'moduleResults', '[]'::jsonb))
  loop
    select id into v_source_id
    from public.osint_sources
    where source_key = v_module->>'id'
    limit 1;

    insert into public.osint_source_runs (
      subject_id,
      source_id,
      module_key,
      status,
      summary,
      started_at,
      finished_at,
      metadata
    )
    values (
      v_subject_id,
      v_source_id,
      coalesce(v_module->>'id', 'unknown'),
      coalesce(v_module->>'status', 'unknown'),
      v_module->>'summary',
      coalesce((p_payload->>'startedAt')::timestamptz, now()),
      coalesce((p_payload->>'finishedAt')::timestamptz, now()),
      v_module
    )
    returning id into v_source_run_id;
  end loop;

  for v_finding in select * from jsonb_array_elements(coalesce(p_payload->'findings', '[]'::jsonb))
  loop
    insert into public.osint_observations (
      subject_id,
      observation_type,
      title,
      value,
      confidence,
      metadata
    )
    values (
      v_subject_id,
      coalesce(v_finding->>'module', 'hallazgo'),
      v_finding->>'title',
      coalesce(v_finding->>'summary', v_finding->>'title'),
      coalesce(v_finding->>'confidence', 'media'),
      v_finding
    )
    returning id into v_observation_id;

    insert into public.osint_evidence (
      observation_id,
      subject_id,
      evidence_type,
      title,
      url,
      extracted_text,
      metadata
    )
    values (
      v_observation_id,
      v_subject_id,
      'url',
      v_finding->>'title',
      v_finding->>'url',
      v_finding->>'summary',
      v_finding
    );
  end loop;

  insert into public.osint_reports (
    subject_id,
    report_type,
    title,
    score,
    summary,
    metadata
  )
  values (
    v_subject_id,
    'commercial_osint',
    'Informe comercial y OSINT consolidado',
    v_score,
    p_payload->>'disclaimer',
    jsonb_build_object(
      'researchPlan', p_payload->'researchPlan',
      'history', v_history,
      'queries', p_payload->'queries'
    )
  );

  return jsonb_build_object('ok', true, 'subject_id', v_subject_id);
end;
$$;

revoke all on function public.store_osint_run(jsonb) from public;
grant execute on function public.store_osint_run(jsonb) to anon, authenticated;
