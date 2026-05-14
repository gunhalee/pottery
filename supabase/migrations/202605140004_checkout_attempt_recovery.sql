create table if not exists public.shop_checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique,
  payload_hash text not null,
  order_id uuid references public.shop_orders(id) on delete set null,
  order_number text,
  recovery_token_hash text,
  recovery_token_expires_at timestamptz,
  payment_id text,
  status text not null default 'started' check (
    status in (
      'started',
      'order_created',
      'payment_prepared',
      'payment_pending',
      'payment_paid',
      'payment_failed',
      'payment_canceled',
      'payment_expired',
      'manual_review'
    )
  ),
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_checkout_attempts_order_id_idx
  on public.shop_checkout_attempts(order_id);

create index if not exists shop_checkout_attempts_payment_id_idx
  on public.shop_checkout_attempts(payment_id);

create index if not exists shop_checkout_attempts_status_created_at_idx
  on public.shop_checkout_attempts(status, created_at desc);

drop trigger if exists shop_checkout_attempts_set_updated_at
  on public.shop_checkout_attempts;

create trigger shop_checkout_attempts_set_updated_at
before update on public.shop_checkout_attempts
for each row execute function public.set_updated_at();

alter table public.shop_checkout_attempts enable row level security;
