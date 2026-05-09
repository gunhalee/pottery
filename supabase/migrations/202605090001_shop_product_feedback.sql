create table if not exists public.shop_product_feedback (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.shop_products (id) on delete cascade,
  kind text not null check (kind in ('review', 'inquiry')),
  author_name text not null check (char_length(author_name) between 1 and 40),
  contact text check (contact is null or char_length(contact) <= 120),
  body text not null check (char_length(body) between 5 and 1200),
  rating smallint check (rating is null or rating between 1 and 5),
  is_private boolean not null default false,
  status text not null default 'pending' check (
    status in ('pending', 'published', 'hidden')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_product_feedback_kind_rating_check check (
    (kind = 'review' and rating is not null)
    or (kind = 'inquiry' and rating is null)
  )
);

drop trigger if exists shop_product_feedback_set_updated_at
on public.shop_product_feedback;
create trigger shop_product_feedback_set_updated_at
before update on public.shop_product_feedback
for each row
execute function public.set_updated_at();

create index if not exists shop_product_feedback_product_kind_status_created_idx
on public.shop_product_feedback (product_id, kind, status, created_at desc);

alter table public.shop_product_feedback enable row level security;
