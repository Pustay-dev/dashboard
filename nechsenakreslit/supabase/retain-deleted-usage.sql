CREATE OR REPLACE FUNCTION public.enqueue_portrait(p_session_id uuid, p_upload_id uuid, p_style_id text, p_request_key uuid, p_recipe jsonb DEFAULT '{}'::jsonb)
 RETURNS generation_jobs
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_session public.sessions%rowtype;
  v_job public.generation_jobs%rowtype;
  v_hash text;
begin
  if p_request_key is null
     or p_style_id is null
     or btrim(p_style_id) = ''
     or p_recipe is null
     or jsonb_typeof(p_recipe) <> 'object' then
    raise exception 'INVALID_REQUEST';
  end if;

  select *
  into v_session
  from public.sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  v_hash := encode(
    sha256(convert_to(
      jsonb_build_object(
        'upload_id', p_upload_id,
        'style_id', btrim(p_style_id),
        'recipe', p_recipe
      )::text,
      'UTF8'
    )),
    'hex'
  );

  select *
  into v_job
  from public.generation_jobs
  where session_id = p_session_id
    and request_key = p_request_key;

  if found then
    if v_job.request_hash <> v_hash then
      raise exception 'REQUEST_KEY_INPUT_MISMATCH';
    end if;
    return v_job;
  end if;

  if v_session.expires_at <= now() then
    raise exception 'SESSION_EXPIRED';
  end if;

  perform private.enforce_gallery_cooldown(p_session_id);

  if exists (
    select 1
    from public.generation_jobs
    where session_id = p_session_id
      and kind = 'portrait'
      and status in ('queued', 'running', 'retry_wait')
  ) then
    raise exception 'PORTRAIT_ALREADY_ACTIVE';
  end if;

  perform 1
  from public.uploads
  where id = p_upload_id
    and session_id = p_session_id
    and status = 'ready'
  for share;

  if not found then
    raise exception 'UPLOAD_NOT_READY';
  end if;

  if p_recipe->>'mode' in ('openai','google') then
    perform pg_advisory_xact_lock(62026002::bigint);
    if not exists (select 1 from private.portrait_generation_limits where id=1 and enabled) then
      raise exception 'PAID_GENERATION_DISABLED';
    end if;
    if (select count(*) from private.portrait_generation_submissions) +
       (select submissions from private.nsl_deleted_generation_totals where id=1) +
       (select count(*) from public.generation_jobs where kind='portrait'
          and status in ('queued','running','retry_wait')
          and provider_submission_state='not_submitted' and provider_submit_count=0
          and recipe->>'mode' in ('openai','google')) >=
       (select submission_limit from private.portrait_generation_limits where id=1) then
      raise exception 'PAID_SUBMISSION_LIMIT_REACHED';
    end if;
  end if;

  insert into public.generation_jobs (
    session_id, kind, upload_id, style_id,
    image_id, request_key, request_hash, recipe
  )
  values (
    p_session_id, 'portrait', p_upload_id,
    btrim(p_style_id), gen_random_uuid(),
    p_request_key, v_hash, p_recipe
  )
  returning * into v_job;

  update public.sessions
  set request_count = request_count + 1,
      updated_at = now()
  where id = p_session_id;

  return v_job;
end;
$function$;

CREATE OR REPLACE FUNCTION public.portrait_generation_guard(p_job_id uuid, p_lease_token uuid, p_action text, p_provider_request_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_result jsonb;
  v_limits private.portrait_generation_limits;
  v_used bigint;
begin
  if p_action = 'begin' then
    perform pg_advisory_xact_lock(62026002::bigint);
  end if;

  v_result := private.portrait_generation_guard(
    p_job_id,
    p_lease_token,
    p_action,
    p_provider_request_id
  );

  if p_action = 'begin'
     and (v_result->>'should_generate')::boolean then
    select *
    into v_limits
    from private.portrait_generation_limits
    where id = 1;

    if not found then
      raise exception 'GENERATION_LIMITS_NOT_CONFIGURED';
    end if;

    if not v_limits.enabled then
      raise exception 'PAID_GENERATION_DISABLED';
    end if;

    select count(*)
    into v_used
    from private.portrait_generation_submissions;
    v_used := v_used + (select submissions from private.nsl_deleted_generation_totals where id=1);

    if v_used >= v_limits.submission_limit then
      raise exception 'PAID_SUBMISSION_LIMIT_REACHED';
    end if;

    insert into private.portrait_generation_submissions(job_id)
    values (p_job_id);
  end if;

  return v_result;
end;
$function$;
