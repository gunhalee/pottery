create table if not exists public.shop_product_sync_logs (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.shop_products (id) on delete cascade,
  provider text not null default 'cafe24' check (provider in ('cafe24')),
  action text not null check (action in ('preview', 'sync', 'manual_mapping')),
  status text not null check (status in ('success', 'failed', 'preview')),
  request_payload jsonb,
  response_payload jsonb,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists shop_product_sync_logs_product_created_at_idx
on public.shop_product_sync_logs (product_id, created_at desc);

create index if not exists shop_product_sync_logs_status_idx
on public.shop_product_sync_logs (status);

alter table public.shop_product_sync_logs enable row level security;
