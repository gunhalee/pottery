create table if not exists public.shop_wishlists (
  id uuid primary key default gen_random_uuid(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_wishlist_items (
  wishlist_id uuid not null references public.shop_wishlists (id) on delete cascade,
  product_id uuid not null references public.shop_products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wishlist_id, product_id)
);

drop trigger if exists shop_wishlists_set_updated_at
on public.shop_wishlists;
create trigger shop_wishlists_set_updated_at
before update on public.shop_wishlists
for each row
execute function public.set_updated_at();

create index if not exists shop_wishlists_last_seen_idx
on public.shop_wishlists (last_seen_at desc);

create index if not exists shop_wishlist_items_product_created_idx
on public.shop_wishlist_items (product_id, created_at desc);

alter table public.shop_wishlists enable row level security;
alter table public.shop_wishlist_items enable row level security;
