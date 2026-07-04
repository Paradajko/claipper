create extension if not exists "pgcrypto";

create table if not exists source_videos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  title text not null,
  source_url text,
  platform text,
  duration_seconds integer,
  transcript text,
  mylaura_campaign_name text,
  mylaura_campaign_url text,
  client_name text,
  status text default 'new',
  notes text,
  raw_data jsonb
);

create table if not exists clips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  source_video_id uuid references source_videos(id) on delete set null,
  title text,
  start_seconds integer,
  end_seconds integer,
  duration_seconds integer,
  hook text,
  caption text,
  hashtags text,
  cta text,
  content_type text,
  score integer,
  status text default 'idea',
  exported_video_url text,
  target_platforms text[],
  mylaura_campaign_name text,
  notes text,
  raw_data jsonb
);

create table if not exists scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  clip_id uuid references clips(id) on delete cascade,
  platform text not null,
  target_account text,
  scheduled_at timestamptz,
  published_at timestamptz,
  post_url text,
  views integer default 0,
  likes integer default 0,
  comments integer default 0,
  shares integer default 0,
  status text default 'scheduled',
  notes text
);

create index if not exists source_videos_status_idx on source_videos(status);
create index if not exists clips_status_idx on clips(status);
create index if not exists clips_source_video_id_idx on clips(source_video_id);
create index if not exists scheduled_posts_clip_id_idx on scheduled_posts(clip_id);
create index if not exists scheduled_posts_scheduled_at_idx on scheduled_posts(scheduled_at);

create table if not exists access_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  email text not null,
  name text,
  use_case text,
  videos_per_week text,
  how_did_you_hear text,
  status text default 'pending',
  notes text
);

create index if not exists access_requests_status_idx on access_requests(status);
create index if not exists access_requests_email_idx on access_requests(email);

alter table source_videos enable row level security;
alter table clips enable row level security;
alter table scheduled_posts enable row level security;
alter table access_requests enable row level security;

drop policy if exists "service_role_all_source_videos" on source_videos;
drop policy if exists "service_role_all_clips" on clips;
drop policy if exists "service_role_all_scheduled_posts" on scheduled_posts;
drop policy if exists "service_role_all_access_requests" on access_requests;
drop policy if exists "anon_insert_access_requests" on access_requests;

create policy "service_role_all_source_videos" on source_videos for all to service_role using (true) with check (true);
create policy "service_role_all_clips" on clips for all to service_role using (true) with check (true);
create policy "service_role_all_scheduled_posts" on scheduled_posts for all to service_role using (true) with check (true);
create policy "service_role_all_access_requests" on access_requests for all to service_role using (true) with check (true);

create policy "anon_insert_access_requests" on access_requests for insert to anon with check (true);
