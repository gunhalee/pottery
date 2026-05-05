create table if not exists public.cafe24_oauth_tokens (
  id text primary key default 'default' check (id = 'default'),
  mall_id text not null,
  access_token text not null,
  refresh_token text,
  token_type text not null default 'Bearer',
  scopes text[] not null default '{}',
  expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists cafe24_oauth_tokens_set_updated_at
on public.cafe24_oauth_tokens;
create trigger cafe24_oauth_tokens_set_updated_at
before update on public.cafe24_oauth_tokens
for each row
execute function public.set_updated_at();

alter table public.cafe24_oauth_tokens enable row level security;
