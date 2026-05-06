create table if not exists public.api_rate_limit_buckets (
  namespace text not null,
  key_hash text not null,
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  limit_count integer not null check (limit_count > 0),
  window_seconds integer not null check (window_seconds > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (namespace, key_hash, window_start)
);

drop trigger if exists api_rate_limit_buckets_set_updated_at
on public.api_rate_limit_buckets;
create trigger api_rate_limit_buckets_set_updated_at
before update on public.api_rate_limit_buckets
for each row
execute function public.set_updated_at();

create index if not exists api_rate_limit_buckets_expires_idx
on public.api_rate_limit_buckets (expires_at);

create index if not exists api_rate_limit_buckets_namespace_updated_idx
on public.api_rate_limit_buckets (namespace, updated_at desc);

alter table public.api_rate_limit_buckets enable row level security;

create or replace function public.consume_api_rate_limit(
  p_namespace text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  request_count integer,
  limit_count integer,
  remaining integer,
  reset_at timestamptz,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := clock_timestamp();
  window_start_ts timestamptz;
  expires_ts timestamptz;
  new_count integer;
begin
  if p_namespace is null or length(trim(p_namespace)) = 0 then
    raise exception 'rate limit namespace is required';
  end if;

  if p_key_hash is null or length(trim(p_key_hash)) = 0 then
    raise exception 'rate limit key hash is required';
  end if;

  if p_limit <= 0 then
    raise exception 'rate limit must be positive';
  end if;

  if p_window_seconds <= 0 then
    raise exception 'rate limit window must be positive';
  end if;

  window_start_ts := to_timestamp(
    floor(extract(epoch from now_ts) / p_window_seconds) * p_window_seconds
  );
  expires_ts := window_start_ts + make_interval(secs => p_window_seconds);

  insert into public.api_rate_limit_buckets (
    namespace,
    key_hash,
    window_start,
    count,
    limit_count,
    window_seconds,
    expires_at
  )
  values (
    p_namespace,
    p_key_hash,
    window_start_ts,
    1,
    p_limit,
    p_window_seconds,
    expires_ts
  )
  on conflict (namespace, key_hash, window_start)
  do update set
    count = public.api_rate_limit_buckets.count + 1,
    expires_at = excluded.expires_at,
    limit_count = excluded.limit_count,
    updated_at = now_ts,
    window_seconds = excluded.window_seconds
  returning public.api_rate_limit_buckets.count into new_count;

  if random() < 0.01 then
    delete from public.api_rate_limit_buckets
    where expires_at < now_ts - interval '1 hour';
  end if;

  return query select
    new_count <= p_limit,
    new_count,
    p_limit,
    greatest(p_limit - new_count, 0),
    expires_ts,
    case
      when new_count <= p_limit then 0
      else greatest(1, ceil(extract(epoch from (expires_ts - now_ts)))::integer)
    end;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer)
from anon, authenticated;

grant execute on function public.consume_api_rate_limit(text, text, integer, integer)
to service_role;
