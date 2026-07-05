insert into storage.buckets (id, name, public)
values
  ('original-videos', 'original-videos', false),
  ('extracted-audio', 'extracted-audio', false),
  ('rendered-clips', 'rendered-clips', false),
  ('subtitles', 'subtitles', false)
on conflict (id) do nothing;

alter table videos add column if not exists source_type text not null default 'direct_upload';
alter table videos add column if not exists source_url text;
alter table videos add column if not exists storage_bucket text;
alter table videos add column if not exists storage_path text;
alter table videos add column if not exists file_size bigint;
alter table videos add column if not exists progress_percent integer not null default 0;

update videos set file_size = size_bytes where file_size is null and size_bytes is not null;
update videos set storage_path = file_path where storage_path is null and file_path is not null;
update videos set storage_bucket = 'original-videos' where storage_bucket is null;

create table if not exists video_imports (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references videos(id) on delete cascade,
  source_url text not null,
  platform text not null,
  status text not null default 'queued',
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  raw_data jsonb
);

alter table processing_jobs add column if not exists clip_idea_id uuid references clip_ideas(id) on delete set null;
alter table processing_jobs add column if not exists clip_id uuid references clips(id) on delete set null;
alter table processing_jobs add column if not exists progress_percent integer not null default 0;
alter table processing_jobs add column if not exists current_step text;
alter table processing_jobs add column if not exists attempts integer not null default 0;
alter table processing_jobs add column if not exists worker_id text;
alter table processing_jobs add column if not exists locked_at timestamptz;

update processing_jobs set current_step = step where current_step is null and step is not null;

alter table transcripts add column if not exists full_text text;
alter table transcripts add column if not exists segments_json jsonb;
update transcripts set full_text = text where full_text is null and text is not null;

alter table clips add column if not exists storage_bucket text;
alter table clips add column if not exists storage_path text;
alter table clips add column if not exists render_status text;
alter table clips add column if not exists type text;
alter table clips add column if not exists updated_at timestamptz default now();
update clips set storage_path = file_path where storage_path is null and file_path is not null;
update clips set storage_bucket = 'rendered-clips' where storage_bucket is null and storage_path is not null;
update clips set render_status = status where render_status is null;
update clips set type = 'draft' where type is null;

create index if not exists videos_source_type_idx on videos(source_type);
create index if not exists video_imports_video_id_idx on video_imports(video_id);
create index if not exists video_imports_status_idx on video_imports(status);
create index if not exists processing_jobs_type_status_idx on processing_jobs(job_type, status);
create index if not exists processing_jobs_locked_at_idx on processing_jobs(locked_at);
create index if not exists processing_jobs_clip_idea_id_idx on processing_jobs(clip_idea_id);

alter table video_imports enable row level security;
drop policy if exists "service_role_all_video_imports" on video_imports;
create policy "service_role_all_video_imports" on video_imports for all to service_role using (true) with check (true);
