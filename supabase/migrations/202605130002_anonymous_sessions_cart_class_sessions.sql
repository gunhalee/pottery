create table if not exists public.anonymous_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists anonymous_sessions_set_updated_at
on public.anonymous_sessions;
create trigger anonymous_sessions_set_updated_at
before update on public.anonymous_sessions
for each row
execute function public.set_updated_at();

create index if not exists anonymous_sessions_expires_at_idx
on public.anonymous_sessions (expires_at);

create index if not exists anonymous_sessions_last_seen_idx
on public.anonymous_sessions (last_seen_at desc);

alter table public.shop_wishlists
  add column if not exists anonymous_session_id uuid
    references public.anonymous_sessions (id) on delete cascade;

do $$
begin
  alter table public.shop_wishlists
    add constraint shop_wishlists_anonymous_session_id_key
    unique (anonymous_session_id);
exception
  when duplicate_object then null;
end $$;

create index if not exists shop_wishlists_session_last_seen_idx
on public.shop_wishlists (anonymous_session_id, last_seen_at desc);

create table if not exists public.shop_cart_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.anonymous_sessions (id) on delete cascade,
  product_id uuid not null references public.shop_products (id) on delete cascade,
  product_slug text not null check (char_length(product_slug) between 1 and 120),
  product_option text not null check (
    product_option in ('plant_excluded', 'plant_included')
  ),
  shipping_method text not null check (
    shipping_method in ('parcel', 'pickup')
  ),
  made_to_order boolean not null default false,
  option_key text not null check (char_length(option_key) between 1 and 240),
  quantity integer not null default 1 check (quantity between 1 and 99),
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, product_id, option_key)
);

drop trigger if exists shop_cart_items_set_updated_at
on public.shop_cart_items;
create trigger shop_cart_items_set_updated_at
before update on public.shop_cart_items
for each row
execute function public.set_updated_at();

create index if not exists shop_cart_items_session_updated_idx
on public.shop_cart_items (session_id, updated_at desc);

create index if not exists shop_cart_items_product_idx
on public.shop_cart_items (product_id);

create table if not exists public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'published' check (
    status in ('draft', 'published', 'archived')
  ),
  session_date date,
  date_label text check (date_label is null or char_length(date_label) <= 80),
  description text check (description is null or char_length(description) <= 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists class_sessions_set_updated_at
on public.class_sessions;
create trigger class_sessions_set_updated_at
before update on public.class_sessions
for each row
execute function public.set_updated_at();

create index if not exists class_sessions_status_date_idx
on public.class_sessions (status, session_date desc nulls last, created_at desc);

create table if not exists public.class_reviews (
  id uuid primary key default gen_random_uuid(),
  participant_name text not null check (char_length(participant_name) between 1 and 40),
  contact text check (contact is null or char_length(contact) <= 120),
  class_session_id uuid references public.class_sessions (id) on delete set null,
  class_title text check (class_title is null or char_length(class_title) <= 80),
  display_name text check (display_name is null or char_length(display_name) <= 40),
  body text not null check (char_length(body) between 5 and 1200),
  status text not null default 'pending' check (
    status in ('hidden', 'pending', 'published')
  ),
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  marketing_consent_scope text,
  consent_text text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists class_reviews_set_updated_at
on public.class_reviews;
create trigger class_reviews_set_updated_at
before update on public.class_reviews
for each row
execute function public.set_updated_at();

create index if not exists class_reviews_status_created_idx
on public.class_reviews (status, created_at desc);

alter table public.class_reviews
  add column if not exists class_session_id uuid
    references public.class_sessions (id) on delete set null;

alter table public.class_review_consents
  add column if not exists class_review_id uuid,
  add column if not exists scope text,
  add column if not exists class_session_id uuid
    references public.class_sessions (id) on delete set null;

update public.class_review_consents
set scope = 'site_sns_class_review'
where scope is null;

alter table public.class_review_consents
  alter column scope set not null;

alter table public.class_review_consents
  drop constraint if exists class_review_consents_class_review_id_fkey;
alter table public.class_review_consents
  add constraint class_review_consents_class_review_id_fkey
  foreign key (class_review_id) references public.class_reviews (id) on delete cascade;

create table if not exists public.class_review_images (
  id uuid primary key default gen_random_uuid(),
  class_review_id uuid not null references public.class_reviews (id) on delete cascade,
  media_asset_id uuid not null references public.media_assets (id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (class_review_id, media_asset_id)
);

create index if not exists class_reviews_session_idx
on public.class_reviews (class_session_id, created_at desc);

create index if not exists class_review_consents_session_idx
on public.class_review_consents (class_session_id, created_at desc);

create index if not exists class_review_consents_review_idx
on public.class_review_consents (class_review_id);

create index if not exists class_review_images_review_sort_idx
on public.class_review_images (class_review_id, sort_order);

create index if not exists class_review_images_asset_idx
on public.class_review_images (media_asset_id);

alter table public.anonymous_sessions enable row level security;
alter table public.shop_cart_items enable row level security;
alter table public.class_sessions enable row level security;
alter table public.class_reviews enable row level security;
alter table public.class_review_images enable row level security;
