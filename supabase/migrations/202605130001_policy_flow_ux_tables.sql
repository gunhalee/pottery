alter table public.shop_notification_jobs
  drop constraint if exists shop_notification_jobs_template_check;

alter table public.shop_notification_jobs
  add constraint shop_notification_jobs_template_check check (
    template in (
      'admin_class_review_consent_received',
      'admin_feedback_received',
      'admin_fulfillment_shipped',
      'admin_gift_address_submitted',
      'admin_order_received',
      'admin_payment_paid',
      'admin_return_request_received',
      'deposit_expired',
      'deposit_guide',
      'deposit_reminder',
      'fulfillment_delivered',
      'fulfillment_preparing',
      'fulfillment_shipped',
      'gift_address_request',
      'gift_address_submitted',
      'made_to_order_confirmed',
      'made_to_order_delay',
      'order_canceled',
      'order_received',
      'payment_attention',
      'payment_paid',
      'picked_up',
      'pickup_ready',
      'return_request_confirmation'
    )
  );

alter table public.shop_product_feedback
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists marketing_consent_at timestamptz,
  add column if not exists marketing_consent_scope text;

create table if not exists public.shop_review_marketing_consents (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.shop_product_feedback (id) on delete cascade,
  scope text not null,
  consent_text text not null,
  consented_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists shop_review_marketing_consents_set_updated_at
on public.shop_review_marketing_consents;
create trigger shop_review_marketing_consents_set_updated_at
before update on public.shop_review_marketing_consents
for each row
execute function public.set_updated_at();

create index if not exists shop_review_marketing_consents_feedback_idx
on public.shop_review_marketing_consents (feedback_id);

create table if not exists public.shop_gift_recipient_links (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'pending' check (
    status in ('pending', 'submitted', 'expired', 'canceled')
  ),
  expires_at timestamptz not null,
  sent_at timestamptz,
  submitted_at timestamptz,
  recipient_name text,
  recipient_phone text,
  shipping_postcode text,
  shipping_address1 text,
  shipping_address2 text,
  shipping_memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id)
);

drop trigger if exists shop_gift_recipient_links_set_updated_at
on public.shop_gift_recipient_links;
create trigger shop_gift_recipient_links_set_updated_at
before update on public.shop_gift_recipient_links
for each row
execute function public.set_updated_at();

create index if not exists shop_gift_recipient_links_order_idx
on public.shop_gift_recipient_links (order_id);

create index if not exists shop_gift_recipient_links_pending_expiry_idx
on public.shop_gift_recipient_links (expires_at)
where status = 'pending';

create table if not exists public.shop_return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  request_type text not null check (
    request_type in ('exchange', 'return', 'refund', 'damage', 'other')
  ),
  reason text not null check (char_length(reason) between 2 and 80),
  detail text not null check (char_length(detail) between 5 and 1200),
  customer_name text not null check (char_length(customer_name) between 1 and 40),
  customer_contact text not null check (char_length(customer_contact) between 4 and 120),
  status text not null default 'submitted' check (
    status in ('submitted', 'reviewing', 'resolved', 'rejected', 'canceled')
  ),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists shop_return_requests_set_updated_at
on public.shop_return_requests;
create trigger shop_return_requests_set_updated_at
before update on public.shop_return_requests
for each row
execute function public.set_updated_at();

create index if not exists shop_return_requests_order_created_idx
on public.shop_return_requests (order_id, created_at desc);

create table if not exists public.shop_return_request_images (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null references public.shop_return_requests (id) on delete cascade,
  media_asset_id uuid not null references public.media_assets (id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (return_request_id, media_asset_id)
);

create index if not exists shop_return_request_images_request_sort_idx
on public.shop_return_request_images (return_request_id, sort_order);

create table if not exists public.class_review_consents (
  id uuid primary key default gen_random_uuid(),
  participant_name text not null check (char_length(participant_name) between 1 and 40),
  contact text check (contact is null or char_length(contact) <= 120),
  class_title text check (class_title is null or char_length(class_title) <= 80),
  display_name text check (display_name is null or char_length(display_name) <= 40),
  consent_text text not null,
  site_sns_consent boolean not null default false,
  work_photo_consent boolean not null default false,
  face_photo_excluded boolean not null default true,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists class_review_consents_set_updated_at
on public.class_review_consents;
create trigger class_review_consents_set_updated_at
before update on public.class_review_consents
for each row
execute function public.set_updated_at();

create index if not exists class_review_consents_created_idx
on public.class_review_consents (created_at desc);

alter table public.shop_gift_recipient_links enable row level security;
alter table public.shop_review_marketing_consents enable row level security;
alter table public.shop_return_requests enable row level security;
alter table public.shop_return_request_images enable row level security;
alter table public.class_review_consents enable row level security;
