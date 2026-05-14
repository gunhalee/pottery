create table if not exists public.naver_blog_posts (
  id uuid primary key default gen_random_uuid(),
  naver_blog_id text not null check (length(trim(naver_blog_id)) > 0),
  guid text not null check (length(trim(guid)) > 0),
  title text not null check (length(trim(title)) > 0),
  link text not null check (link ~ '^https?://'),
  description_html text not null default '',
  summary text not null default '',
  thumbnail_url text,
  category text,
  tags text[] not null default '{}',
  pub_date timestamptz not null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (naver_blog_id, guid)
);

drop trigger if exists naver_blog_posts_set_updated_at on public.naver_blog_posts;
create trigger naver_blog_posts_set_updated_at
before update on public.naver_blog_posts
for each row
execute function public.set_updated_at();

create index if not exists naver_blog_posts_pub_date_idx
on public.naver_blog_posts (pub_date desc);

create index if not exists naver_blog_posts_blog_pub_date_idx
on public.naver_blog_posts (naver_blog_id, pub_date desc);

alter table public.naver_blog_posts enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant select on public.naver_blog_posts to anon';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant select on public.naver_blog_posts to authenticated';
  end if;
end;
$$;

drop policy if exists "Public can read naver blog posts" on public.naver_blog_posts;
create policy "Public can read naver blog posts"
on public.naver_blog_posts
for select
to anon, authenticated
using (true);

alter table public.cron_run_logs
  drop constraint if exists cron_run_logs_job_name_check;

alter table public.cron_run_logs
  add constraint cron_run_logs_job_name_check check (
    job_name in (
      'daily_maintenance',
      'naver_blog_sync',
      'order_notifications',
      'portone_payment_reconcile',
      'upload_cleanup',
      'virtual_account_expiry'
    )
  );
