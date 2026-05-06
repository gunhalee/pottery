create table if not exists public.upload_cleanup_logs (
  id bigint generated always as identity primary key,
  bucket text not null,
  storage_path text not null,
  reason text not null,
  dry_run boolean not null default false,
  success boolean not null default false,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists upload_cleanup_logs_created_at_idx
on public.upload_cleanup_logs (created_at desc);

create index if not exists upload_cleanup_logs_bucket_reason_idx
on public.upload_cleanup_logs (bucket, reason, created_at desc);

alter table public.upload_cleanup_logs enable row level security;
