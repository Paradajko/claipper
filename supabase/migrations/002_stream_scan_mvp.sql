create table if not exists videos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  title text not null,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  duration_seconds integer,
  file_path text not null,
  audio_path text,
  status text not null default 'uploaded',
  progress_text text,
  error_message text,
  raw_data jsonb
);

create table if not exists transcripts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  video_id uuid not null references videos(id) on delete cascade,
  status text not null default 'pending',
  language text,
  text text,
  raw_data jsonb
);

create table if not exists transcript_segments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  video_id uuid not null references videos(id) on delete cascade,
  transcript_id uuid references transcripts(id) on delete cascade,
  segment_index integer not null,
  start_time integer not null,
  end_time integer not null,
  text text not null,
  status text not null default 'pending',
  raw_data jsonb
);

create table if not exists clip_ideas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  video_id uuid not null references videos(id) on delete cascade,
  title text not null,
  start_time integer not null,
  end_time integer not null,
  score integer not null,
  reason text not null,
  hook text not null,
  caption text not null,
  difficulty text not null,
  clip_type text not null,
  status text not null default 'idea',
  raw_data jsonb
);

create table if not exists processing_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  video_id uuid references videos(id) on delete cascade,
  job_type text not null,
  status text not null default 'queued',
  step text,
  error_message text,
  raw_data jsonb
);

alter table clips add column if not exists video_id uuid references videos(id) on delete set null;
alter table clips add column if not exists clip_idea_id uuid references clip_ideas(id) on delete set null;
alter table clips add column if not exists file_path text;

create index if not exists videos_status_idx on videos(status);
create index if not exists transcripts_video_id_idx on transcripts(video_id);
create index if not exists transcript_segments_video_id_idx on transcript_segments(video_id);
create index if not exists transcript_segments_video_segment_idx on transcript_segments(video_id, segment_index);
create index if not exists clip_ideas_video_id_idx on clip_ideas(video_id);
create index if not exists clip_ideas_score_idx on clip_ideas(score desc);
create index if not exists clips_video_id_idx on clips(video_id);
create index if not exists clips_clip_idea_id_idx on clips(clip_idea_id);
create index if not exists processing_jobs_video_id_idx on processing_jobs(video_id);
create index if not exists processing_jobs_status_idx on processing_jobs(status);

alter table videos enable row level security;
alter table transcripts enable row level security;
alter table transcript_segments enable row level security;
alter table clip_ideas enable row level security;
alter table processing_jobs enable row level security;

drop policy if exists "service_role_all_videos" on videos;
drop policy if exists "service_role_all_transcripts" on transcripts;
drop policy if exists "service_role_all_transcript_segments" on transcript_segments;
drop policy if exists "service_role_all_clip_ideas" on clip_ideas;
drop policy if exists "service_role_all_processing_jobs" on processing_jobs;

create policy "service_role_all_videos" on videos for all to service_role using (true) with check (true);
create policy "service_role_all_transcripts" on transcripts for all to service_role using (true) with check (true);
create policy "service_role_all_transcript_segments" on transcript_segments for all to service_role using (true) with check (true);
create policy "service_role_all_clip_ideas" on clip_ideas for all to service_role using (true) with check (true);
create policy "service_role_all_processing_jobs" on processing_jobs for all to service_role using (true) with check (true);
