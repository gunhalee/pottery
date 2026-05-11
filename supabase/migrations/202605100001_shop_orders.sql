create extension if not exists pgcrypto;

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique check (order_number ~ '^CP-[0-9]{8}-[0-9]{6}$'),
  order_status text not null default 'pending_payment' check (
    order_status in (
      'draft',
      'pending_payment',
      'paid',
      'preparing',
      'shipped',
      'delivered',
      'canceled',
      'refunded'
    )
  ),
  payment_status text not null default 'unpaid' check (
    payment_status in (
      'unpaid',
      'pending',
      'paid',
      'failed',
      'canceled',
      'partial_refunded',
      'refunded'
    )
  ),
  fulfillment_status text not null default 'unfulfilled' check (
    fulfillment_status in (
      'unfulfilled',
      'pickup_ready',
      'picked_up',
      'preparing',
      'shipped',
      'delivered',
      'returned',
      'canceled'
    )
  ),
  orderer_name text not null,
  orderer_phone text not null,
  orderer_phone_last4 text not null check (orderer_phone_last4 ~ '^[0-9]{4}$'),
  orderer_email text not null,
  lookup_password_hash text not null,
  is_gift boolean not null default false,
  gift_message text,
  recipient_name text,
  recipient_phone text,
  shipping_postcode text,
  shipping_address1 text,
  shipping_address2 text,
  shipping_memo text,
  shipping_method text not null default 'parcel' check (shipping_method in ('parcel', 'pickup')),
  currency text not null default 'KRW' check (currency = 'KRW'),
  subtotal_krw integer not null check (subtotal_krw >= 0),
  shipping_fee_krw integer not null default 0 check (shipping_fee_krw >= 0),
  total_krw integer not null check (total_krw >= 0),
  portone_payment_id text unique,
  portone_transaction_id text,
  paid_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  product_id uuid references public.shop_products (id) on delete set null,
  product_slug text not null,
  product_title text not null,
  unit_price_krw integer not null check (unit_price_krw >= 0),
  quantity integer not null check (quantity > 0),
  line_total_krw integer not null check (line_total_krw >= 0),
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  provider text not null default 'portone' check (provider in ('portone')),
  provider_payment_id text not null,
  provider_transaction_id text,
  payment_method text,
  status text not null check (
    status in ('requested', 'pending', 'paid', 'failed', 'canceled', 'partial_refunded', 'refunded')
  ),
  amount_krw integer not null check (amount_krw >= 0),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

create table if not exists public.shop_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  carrier text,
  tracking_number text,
  tracking_url text,
  status text not null default 'preparing' check (
    status in ('preparing', 'shipped', 'delivered', 'returned', 'canceled')
  ),
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  event_type text not null,
  actor text not null default 'system',
  note text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

drop trigger if exists shop_orders_set_updated_at on public.shop_orders;
create trigger shop_orders_set_updated_at
before update on public.shop_orders
for each row
execute function public.set_updated_at();

drop trigger if exists shop_payments_set_updated_at on public.shop_payments;
create trigger shop_payments_set_updated_at
before update on public.shop_payments
for each row
execute function public.set_updated_at();

drop trigger if exists shop_shipments_set_updated_at on public.shop_shipments;
create trigger shop_shipments_set_updated_at
before update on public.shop_shipments
for each row
execute function public.set_updated_at();

create index if not exists shop_orders_created_at_idx
on public.shop_orders (created_at desc);

create index if not exists shop_orders_status_created_at_idx
on public.shop_orders (order_status, created_at desc);

create index if not exists shop_orders_lookup_idx
on public.shop_orders (order_number, orderer_phone_last4);

create index if not exists shop_order_items_order_id_idx
on public.shop_order_items (order_id);

create index if not exists shop_payments_order_id_idx
on public.shop_payments (order_id, created_at desc);

create index if not exists shop_shipments_order_id_idx
on public.shop_shipments (order_id, created_at desc);

create index if not exists shop_order_events_order_id_created_at_idx
on public.shop_order_events (order_id, created_at desc);

alter table public.shop_orders enable row level security;
alter table public.shop_order_items enable row level security;
alter table public.shop_payments enable row level security;
alter table public.shop_shipments enable row level security;
alter table public.shop_order_events enable row level security;
