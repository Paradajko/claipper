create table if not exists campaign_analyses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  creator_name text not null,
  youtube_url text,
  kick_url text,
  clipper_youtube_url text,
  monthly_budget_eur numeric not null default 0 check (monthly_budget_eur >= 0),
  reward_per_1000_views_eur numeric not null default 0 check (reward_per_1000_views_eur >= 0),
  tiktok_account_count integer not null default 0 check (tiktok_account_count >= 0),
  instagram_account_count integer not null default 0 check (instagram_account_count >= 0),
  youtube_shorts_account_count integer not null default 0 check (youtube_shorts_account_count >= 0),
  clips_per_day numeric not null default 0 check (clips_per_day >= 0),
  campaign_duration_days integer not null default 0 check (campaign_duration_days >= 0),
  content_hours_per_good_clip numeric not null default 0 check (content_hours_per_good_clip >= 0),
  manual_expected_views_per_upload numeric check (manual_expected_views_per_upload is null or manual_expected_views_per_upload >= 0),
  status text not null default 'draft' check (status in ('draft', 'analyzing', 'completed', 'failed')),
  automatic_metadata jsonb not null default '{}'::jsonb,
  manual_overrides jsonb not null default '{}'::jsonb,
  source_statuses jsonb not null default '{}'::jsonb,
  last_successful_metadata_at timestamptz,
  error_message text
);

create index if not exists campaign_analyses_updated_at_idx on campaign_analyses(updated_at desc);
create index if not exists campaign_analyses_status_idx on campaign_analyses(status);
create unique index if not exists processing_jobs_campaign_analysis_active_idx
  on processing_jobs ((raw_data->>'campaign_analysis_id'))
  where job_type = 'campaign_analysis' and status in ('queued', 'running');

create or replace function queue_campaign_analysis(p_analysis_id uuid)
returns processing_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  queued_job processing_jobs;
begin
  select * into queued_job from processing_jobs
  where job_type = 'campaign_analysis'
    and status in ('queued', 'running')
    and raw_data->>'campaign_analysis_id' = p_analysis_id::text
  order by created_at desc limit 1;
  if found then return queued_job; end if;

  update campaign_analyses
  set status = 'analyzing', error_message = null, updated_at = now()
  where id = p_analysis_id;
  if not found then raise exception 'campaign analysis not found'; end if;

  insert into processing_jobs (video_id, job_type, status, step, raw_data)
  values (null, 'campaign_analysis', 'queued', 'campaign_analysis_queued', jsonb_build_object('campaign_analysis_id', p_analysis_id))
  returning * into queued_job;
  return queued_job;
exception when unique_violation then
  select * into queued_job from processing_jobs
  where job_type = 'campaign_analysis'
    and status in ('queued', 'running')
    and raw_data->>'campaign_analysis_id' = p_analysis_id::text
  order by created_at desc limit 1;
  return queued_job;
end;
$$;

revoke all on function queue_campaign_analysis(uuid) from public;
grant execute on function queue_campaign_analysis(uuid) to service_role;

alter table campaign_analyses enable row level security;
drop policy if exists "service_role_all_campaign_analyses" on campaign_analyses;
create policy "service_role_all_campaign_analyses" on campaign_analyses
  for all to service_role using (true) with check (true);
