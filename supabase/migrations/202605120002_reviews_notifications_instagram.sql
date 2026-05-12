alter table public.shop_notification_jobs
  drop constraint if exists shop_notification_jobs_template_check;

alter table public.shop_notification_jobs
  add constraint shop_notification_jobs_template_check check (
    template in (
      'admin_feedback_received',
      'admin_fulfillment_shipped',
      'admin_order_received',
      'admin_payment_paid',
      'deposit_expired',
      'deposit_guide',
      'deposit_reminder',
      'fulfillment_delivered',
      'fulfillment_preparing',
      'fulfillment_shipped',
      'made_to_order_confirmed',
      'made_to_order_delay',
      'order_canceled',
      'order_received',
      'payment_attention',
      'payment_paid',
      'picked_up',
      'pickup_ready'
    )
  );

create table if not exists public.shop_product_feedback_images (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.shop_product_feedback (id) on delete cascade,
  media_asset_id uuid not null references public.media_assets (id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (feedback_id, media_asset_id)
);

create index if not exists shop_product_feedback_images_feedback_sort_idx
on public.shop_product_feedback_images (feedback_id, sort_order);

create index if not exists shop_product_feedback_images_asset_idx
on public.shop_product_feedback_images (media_asset_id);

alter table public.shop_product_feedback_images enable row level security;
