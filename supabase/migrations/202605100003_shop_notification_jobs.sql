create table if not exists public.shop_notification_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.shop_orders (id) on delete set null,
  channel text not null check (channel in ('email', 'kakao')),
  template text not null check (
    template in (
      'order_received',
      'payment_paid',
      'payment_attention',
      'fulfillment_preparing',
      'fulfillment_shipped',
      'fulfillment_delivered',
      'pickup_ready',
      'picked_up',
      'order_canceled'
    )
  ),
  recipient text,
  status text not null default 'pending' check (
    status in ('pending', 'skipped', 'sent', 'failed')
  ),
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists shop_notification_jobs_set_updated_at
on public.shop_notification_jobs;
create trigger shop_notification_jobs_set_updated_at
before update on public.shop_notification_jobs
for each row
execute function public.set_updated_at();

create index if not exists shop_notification_jobs_status_created_at_idx
on public.shop_notification_jobs (status, created_at);

create index if not exists shop_notification_jobs_order_id_created_at_idx
on public.shop_notification_jobs (order_id, created_at desc);

alter table public.shop_notification_jobs enable row level security;
