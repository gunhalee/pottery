create extension if not exists pgcrypto;

create table if not exists public.storage_upload_intents (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null,
  bucket text not null default 'media-assets',
  owner_type text check (
    owner_type is null
    or owner_type in ('content_entry', 'product')
  ),
  owner_id uuid,
  status text not null default 'pending' check (
    status in (
      'pending',
      'uploading',
      'uploaded',
      'claimed',
      'cleanup_pending',
      'cleaned',
      'failed'
    )
  ),
  storage_paths text[] not null default '{}',
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists storage_upload_intents_set_updated_at
on public.storage_upload_intents;
create trigger storage_upload_intents_set_updated_at
before update on public.storage_upload_intents
for each row
execute function public.set_updated_at();

create index if not exists storage_upload_intents_asset_idx
on public.storage_upload_intents (asset_id);

create index if not exists storage_upload_intents_status_created_idx
on public.storage_upload_intents (status, created_at desc);

create index if not exists storage_upload_intents_owner_idx
on public.storage_upload_intents (owner_type, owner_id, created_at desc)
where owner_type is not null and owner_id is not null;

alter table public.storage_upload_intents enable row level security;
