alter table videos add column if not exists source_storage_provider text not null default 'supabase';
alter table videos add column if not exists source_storage_path text;

update videos
set source_storage_provider = 'supabase',
    source_storage_path = storage_path
where source_storage_path is null
  and storage_path is not null;

create index if not exists videos_source_storage_provider_idx on videos(source_storage_provider);
