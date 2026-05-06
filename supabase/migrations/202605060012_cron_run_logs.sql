create extension if not exists pgcrypto;

create table if not exists public.cron_run_logs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null check (job_name in ('cafe24_inventory', 'upload_cleanup')),
  status text not null default 'running' check (status in ('running', 'success', 'failed')),
  trigger_source text not null default 'http',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists cron_run_logs_set_updated_at on public.cron_run_logs;
create trigger cron_run_logs_set_updated_at
before update on public.cron_run_logs
for each row
execute function public.set_updated_at();

create index if not exists cron_run_logs_job_started_idx
on public.cron_run_logs (job_name, started_at desc);

create index if not exists cron_run_logs_status_started_idx
on public.cron_run_logs (status, started_at desc);

create index if not exists cron_run_logs_running_started_idx
on public.cron_run_logs (started_at desc)
where status = 'running';

alter table public.cron_run_logs enable row level security;
