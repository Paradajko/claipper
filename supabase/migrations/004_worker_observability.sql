create table if not exists worker_heartbeats (
  id uuid primary key default gen_random_uuid(),
  worker_id text not null unique,
  status text not null default 'online',
  last_seen_at timestamptz not null default now(),
  current_job_id uuid references processing_jobs(id) on delete set null,
  current_step text,
  metadata_json jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table processing_jobs add column if not exists started_at timestamptz;
alter table processing_jobs add column if not exists completed_at timestamptz;
alter table processing_jobs add column if not exists failed_at timestamptz;
alter table processing_jobs add column if not exists technical_error text;

create index if not exists worker_heartbeats_last_seen_idx on worker_heartbeats(last_seen_at desc);
create index if not exists worker_heartbeats_status_idx on worker_heartbeats(status);
create index if not exists processing_jobs_started_at_idx on processing_jobs(started_at);
create index if not exists processing_jobs_completed_at_idx on processing_jobs(completed_at);
create index if not exists processing_jobs_failed_at_idx on processing_jobs(failed_at);

alter table worker_heartbeats enable row level security;
drop policy if exists "service_role_all_worker_heartbeats" on worker_heartbeats;
create policy "service_role_all_worker_heartbeats" on worker_heartbeats for all to service_role using (true) with check (true);
