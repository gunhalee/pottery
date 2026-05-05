create extension if not exists pgcrypto;

create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_ko text not null,
  short_description text not null,
  story text,
  category text not null,
  kind text not null check (kind in ('regular', 'one_of_a_kind')),
  is_limited boolean not null default false,
  limited_type text check (
    limited_type is null
    or limited_type in ('quantity', 'period', 'kiln_batch', 'project')
  ),
  is_archived boolean not null default false,
  restock_cta_type text check (
    restock_cta_type is null
    or restock_cta_type in (
      'restock_alert',
      'similar_work_alert',
      'next_limited_alert'
    )
  ),
  availability_status text not null check (
    availability_status in ('available', 'sold_out', 'upcoming', 'archive')
  ),
  price_krw integer check (price_krw is null or price_krw >= 0),
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  currency text not null default 'KRW' check (currency = 'KRW'),
  material text,
  glaze text,
  size text,
  usage_note text,
  care_note text,
  shipping_note text,
  published boolean not null default false,
  published_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_product_images (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.shop_products (id) on delete cascade,
  src text,
  alt text not null,
  cafe24_image_path text,
  placeholder_label text,
  is_primary boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_product_cafe24_mappings (
  product_id uuid primary key references public.shop_products (id) on delete cascade,
  product_no text unique,
  variant_code text,
  product_url text,
  checkout_url text,
  category_no integer check (category_no is null or category_no > 0),
  display_group integer not null default 1 check (display_group > 0),
  mapping_status text not null default 'pending' check (
    mapping_status in ('pending', 'mapped', 'sync_failed', 'not_applicable')
  ),
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists shop_products_set_updated_at on public.shop_products;
create trigger shop_products_set_updated_at
before update on public.shop_products
for each row
execute function public.set_updated_at();

drop trigger if exists shop_product_images_set_updated_at on public.shop_product_images;
create trigger shop_product_images_set_updated_at
before update on public.shop_product_images
for each row
execute function public.set_updated_at();

drop trigger if exists shop_product_cafe24_mappings_set_updated_at
on public.shop_product_cafe24_mappings;
create trigger shop_product_cafe24_mappings_set_updated_at
before update on public.shop_product_cafe24_mappings
for each row
execute function public.set_updated_at();

create index if not exists shop_products_published_created_at_idx
on public.shop_products (published, created_at desc);

create index if not exists shop_products_availability_status_idx
on public.shop_products (availability_status);

create index if not exists shop_product_images_product_id_sort_order_idx
on public.shop_product_images (product_id, sort_order);

create unique index if not exists shop_product_images_one_primary_idx
on public.shop_product_images (product_id)
where is_primary;

create index if not exists shop_product_cafe24_mappings_status_idx
on public.shop_product_cafe24_mappings (mapping_status);

alter table public.shop_products enable row level security;
alter table public.shop_product_images enable row level security;
alter table public.shop_product_cafe24_mappings enable row level security;

insert into public.shop_products (
  id,
  slug,
  title_ko,
  short_description,
  story,
  category,
  kind,
  is_limited,
  limited_type,
  is_archived,
  restock_cta_type,
  availability_status,
  price_krw,
  stock_quantity,
  material,
  glaze,
  size,
  usage_note,
  care_note,
  shipping_note,
  published,
  published_at
)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'moon-white-bowl',
    '달빛 백자 보울',
    '차분한 백색 유약과 손에 감기는 작은 굽을 가진 생활 보울입니다.',
    '매일의 식탁에서 가장 자주 손이 가는 크기를 기준으로 빚었습니다. 얇은 가장자리는 부드럽게 다듬고, 유약의 흐름은 담백하게 남겼습니다.',
    'cup',
    'regular',
    false,
    null,
    false,
    'restock_alert',
    'available',
    38000,
    4,
    '백자토',
    '투명유',
    '지름 약 11cm, 높이 약 5cm',
    '식기로 사용할 수 있습니다.',
    '강한 충격과 급격한 온도 변화를 피해 주세요.',
    '완충 포장 후 Cafe24 주문 정보를 기준으로 배송합니다.',
    true,
    '2026-05-05'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'ash-glaze-cup',
    '재유 잔',
    '소성 흐름에 따라 유약의 표정이 달라지는 하나뿐인 잔입니다.',
    '같은 배합의 유약이어도 가마 안의 위치와 불의 흐름에 따라 색감이 조금씩 달라집니다. 이 잔은 가장자리의 옅은 흐름을 살려 아카이브합니다.',
    'cup',
    'one_of_a_kind',
    false,
    null,
    true,
    'similar_work_alert',
    'sold_out',
    42000,
    0,
    '분청토',
    '재유',
    '지름 약 8cm, 높이 약 7cm',
    '차와 작은 음료를 담기 좋습니다.',
    '사용 후 충분히 건조해 보관해 주세요.',
    '예전 판매 완료 아카이브 작품입니다.',
    true,
    '2026-05-05'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'kiln-limited-vase',
    '계절 소성 한정 화병',
    '이번 계절 소성에서만 제작하는 작은 화병입니다.',
    '계절별 유약 테스트와 소성 분위기를 기록하기 위한 한정 작업입니다. 같은 가마 안에서만 만들어지는 색과 질감을 중심으로 소개합니다.',
    'limited',
    'one_of_a_kind',
    true,
    'kiln_batch',
    false,
    'next_limited_alert',
    'upcoming',
    68000,
    1,
    '혼합토',
    '계절 테스트 유약',
    '높이 약 13cm',
    '드라이플라워와 작은 생화를 꽂기 좋습니다.',
    '물 사용 후 바닥면을 충분히 말려 주세요.',
    '입고 일정 확정 후 Cafe24 상품으로 연결합니다.',
    true,
    '2026-05-05'
  )
on conflict (slug) do update set
  title_ko = excluded.title_ko,
  short_description = excluded.short_description,
  story = excluded.story,
  category = excluded.category,
  kind = excluded.kind,
  is_limited = excluded.is_limited,
  limited_type = excluded.limited_type,
  is_archived = excluded.is_archived,
  restock_cta_type = excluded.restock_cta_type,
  availability_status = excluded.availability_status,
  price_krw = excluded.price_krw,
  stock_quantity = excluded.stock_quantity,
  material = excluded.material,
  glaze = excluded.glaze,
  size = excluded.size,
  usage_note = excluded.usage_note,
  care_note = excluded.care_note,
  shipping_note = excluded.shipping_note,
  published = excluded.published,
  published_at = excluded.published_at;

insert into public.shop_product_images (
  product_id,
  alt,
  placeholder_label,
  is_primary,
  sort_order
)
values
  (
    '00000000-0000-0000-0000-000000000001',
    '달빛 백자 보울 대표 이미지',
    'Moon Bowl',
    true,
    0
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '재유 잔 대표 이미지',
    'Ash Cup',
    true,
    0
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '계절 소성 한정 화병 대표 이미지',
    'Limited Vase',
    true,
    0
  )
on conflict do nothing;

insert into public.shop_product_cafe24_mappings (
  product_id,
  category_no,
  display_group,
  mapping_status,
  product_no
)
values
  ('00000000-0000-0000-0000-000000000001', 29, 1, 'pending', null),
  ('00000000-0000-0000-0000-000000000002', 29, 1, 'pending', null),
  ('00000000-0000-0000-0000-000000000003', 29, 1, 'pending', null)
on conflict (product_id) do update set
  category_no = excluded.category_no,
  display_group = excluded.display_group,
  mapping_status = excluded.mapping_status;
