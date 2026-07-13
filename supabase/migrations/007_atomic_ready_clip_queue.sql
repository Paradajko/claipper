alter table clips alter column start_seconds type double precision using start_seconds::double precision;
alter table clips alter column end_seconds type double precision using end_seconds::double precision;
alter table clips alter column duration_seconds type double precision using duration_seconds::double precision;

create or replace function queue_ready_clip_render(
  p_video_id uuid,
  p_clip_idea_id uuid,
  p_title text,
  p_start_seconds double precision,
  p_end_seconds double precision,
  p_hook text,
  p_caption text,
  p_content_type text,
  p_score integer,
  p_storage_bucket text,
  p_clip_raw_data jsonb,
  p_job_raw_data jsonb
)
returns table (clip_id uuid, job_id uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_clip_id uuid;
  v_job_id uuid;
begin
  insert into clips (
    video_id,
    clip_idea_id,
    title,
    start_seconds,
    end_seconds,
    duration_seconds,
    hook,
    caption,
    content_type,
    score,
    status,
    render_status,
    type,
    storage_bucket,
    raw_data
  ) values (
    p_video_id,
    p_clip_idea_id,
    p_title,
    p_start_seconds,
    p_end_seconds,
    p_end_seconds - p_start_seconds,
    p_hook,
    p_caption,
    p_content_type,
    p_score,
    'editing',
    'queued',
    'ready',
    p_storage_bucket,
    p_clip_raw_data
  )
  returning id into v_clip_id;

  insert into processing_jobs (
    video_id,
    clip_idea_id,
    clip_id,
    job_type,
    status,
    progress_percent,
    current_step,
    step,
    raw_data
  ) values (
    p_video_id,
    p_clip_idea_id,
    v_clip_id,
    'render_ready_clip',
    'queued',
    0,
    'queued',
    'queued',
    p_job_raw_data
  )
  returning id into v_job_id;

  return query select v_clip_id, v_job_id;
end;
$$;

revoke all on function queue_ready_clip_render(
  uuid, uuid, text, double precision, double precision, text, text, text,
  integer, text, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function queue_ready_clip_render(
  uuid, uuid, text, double precision, double precision, text, text, text,
  integer, text, jsonb, jsonb
) to service_role;

create or replace function complete_render_job(
  p_job_id uuid,
  p_worker_process_id text,
  p_clip_id uuid,
  p_clip_idea_id uuid,
  p_storage_bucket text,
  p_storage_path text,
  p_clip_status text,
  p_clip_raw_data jsonb,
  p_idea_status text,
  p_job_step text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_clip_id uuid;
  v_clip_idea_id uuid;
begin
  select clip_id, clip_idea_id
  into v_clip_id, v_clip_idea_id
  from processing_jobs
  where id = p_job_id
    and status = 'running'
    and worker_id = p_worker_process_id
  for update;

  if not found
    or v_clip_id is distinct from p_clip_id
    or v_clip_idea_id is distinct from p_clip_idea_id then
    return false;
  end if;

  update clips
  set storage_bucket = p_storage_bucket,
      storage_path = p_storage_path,
      file_path = p_storage_path,
      render_status = 'completed',
      status = p_clip_status,
      exported_video_url = null,
      raw_data = p_clip_raw_data,
      updated_at = now()
  where id = v_clip_id;

  if not found then
    raise exception 'Clip % for render job % was not found', v_clip_id, p_job_id;
  end if;

  if v_clip_idea_id is not null then
    update clip_ideas
    set status = p_idea_status
    where id = v_clip_idea_id;
  end if;

  update processing_jobs
  set status = 'completed',
      current_step = p_job_step,
      step = p_job_step,
      progress_percent = 100,
      completed_at = now(),
      updated_at = now()
  where id = p_job_id;

  return true;
end;
$$;

revoke all on function complete_render_job(
  uuid, text, uuid, uuid, text, text, text, jsonb, text, text
) from public, anon, authenticated;

grant execute on function complete_render_job(
  uuid, text, uuid, uuid, text, text, text, jsonb, text, text
) to service_role;

create or replace function fail_processing_job(
  p_job_id uuid,
  p_worker_process_id text,
  p_clip_id uuid,
  p_clip_idea_id uuid,
  p_user_error text,
  p_technical_error text,
  p_progress_percent integer,
  p_clip_raw_data jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_clip_id uuid;
  v_clip_idea_id uuid;
begin
  select clip_id, clip_idea_id
  into v_clip_id, v_clip_idea_id
  from processing_jobs
  where id = p_job_id
    and status = 'running'
    and worker_id = p_worker_process_id
  for update;

  if not found
    or v_clip_id is distinct from p_clip_id
    or v_clip_idea_id is distinct from p_clip_idea_id then
    return false;
  end if;

  if v_clip_id is not null then
    update clips
    set render_status = 'failed',
        status = 'editing',
        raw_data = coalesce(p_clip_raw_data, raw_data),
        updated_at = now()
    where id = v_clip_id;
  end if;

  if v_clip_idea_id is not null then
    update clip_ideas
    set status = 'selected'
    where id = v_clip_idea_id;
  end if;

  update processing_jobs
  set status = 'failed',
      current_step = 'failed',
      step = 'failed',
      progress_percent = p_progress_percent,
      error_message = p_user_error,
      technical_error = p_technical_error,
      failed_at = now(),
      updated_at = now()
  where id = p_job_id;

  return true;
end;
$$;

revoke all on function fail_processing_job(
  uuid, text, uuid, uuid, text, text, integer, jsonb
) from public, anon, authenticated;

grant execute on function fail_processing_job(
  uuid, text, uuid, uuid, text, text, integer, jsonb
) to service_role;
