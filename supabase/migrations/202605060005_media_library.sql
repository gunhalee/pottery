create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket text not null default 'media-assets',
  master_path text not null unique,
  src text not null,
  alt text not null default '',
  caption text,
  artwork_title text,
  reserved boolean not null default false,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  mime_type text not null default 'image/webp',
  size_bytes integer check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_variants (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.media_assets (id) on delete cascade,
  variant text not null check (variant in ('master', 'thumbnail', 'list', 'detail')),
  storage_path text not null unique,
  src text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  size_bytes integer check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default now(),
  unique (asset_id, variant)
);

create table if not exists public.media_usages (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.media_assets (id) on delete restrict,
  owner_type text not null check (owner_type in ('content_entry', 'product')),
  owner_id uuid not null,
  role text not null check (role in ('cover', 'list', 'detail', 'body', 'description')),
  sort_order integer not null default 0 check (sort_order >= 0),
  alt_override text,
  caption_override text,
  layout text check (
    layout is null
    or layout in ('default', 'wide', 'full', 'two-column', 'align-left', 'align-right')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (
      owner_type = 'content_entry'
      and role in ('cover', 'list', 'detail', 'body')
    )
    or (
      owner_type = 'product'
      and role in ('cover', 'list', 'detail', 'description')
    )
  )
);

alter table public.shop_products
add column if not exists story_json jsonb not null default '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}'::jsonb,
add column if not exists story_text text not null default '';

update public.shop_products
set
  story_json = jsonb_build_object(
    'root',
    jsonb_build_object(
      'children',
      jsonb_build_array(
        jsonb_build_object(
          'children',
          case
            when coalesce(story, '') = '' then '[]'::jsonb
            else jsonb_build_array(
              jsonb_build_object(
                'detail',
                0,
                'format',
                0,
                'mode',
                'normal',
                'style',
                '',
                'text',
                story,
                'type',
                'text',
                'version',
                1
              )
            )
          end,
          'direction',
          null,
          'format',
          '',
          'indent',
          0,
          'type',
          'paragraph',
          'version',
          1
        )
      ),
      'direction',
      null,
      'format',
      '',
      'indent',
      0,
      'type',
      'root',
      'version',
      1
    )
  ),
  story_text = coalesce(story, '')
where story_text = '';

drop trigger if exists media_assets_set_updated_at on public.media_assets;
create trigger media_assets_set_updated_at
before update on public.media_assets
for each row
execute function public.set_updated_at();

drop trigger if exists media_usages_set_updated_at on public.media_usages;
create trigger media_usages_set_updated_at
before update on public.media_usages
for each row
execute function public.set_updated_at();

create index if not exists media_assets_reserved_created_at_idx
on public.media_assets (reserved, created_at desc);

create index if not exists media_assets_artwork_title_idx
on public.media_assets (artwork_title)
where artwork_title is not null;

create index if not exists media_variants_asset_variant_idx
on public.media_variants (asset_id, variant);

create index if not exists media_usages_owner_role_sort_idx
on public.media_usages (owner_type, owner_id, role, sort_order);

create index if not exists media_usages_asset_idx
on public.media_usages (asset_id);

create unique index if not exists media_usages_unique_owner_asset_role_idx
on public.media_usages (owner_type, owner_id, asset_id, role);

create unique index if not exists media_usages_content_one_cover_idx
on public.media_usages (owner_id)
where owner_type = 'content_entry' and role = 'cover';

create unique index if not exists media_usages_content_one_list_idx
on public.media_usages (owner_id)
where owner_type = 'content_entry' and role = 'list';

create unique index if not exists media_usages_product_one_cover_idx
on public.media_usages (owner_id)
where owner_type = 'product' and role = 'cover';

create unique index if not exists media_usages_product_one_list_idx
on public.media_usages (owner_id)
where owner_type = 'product' and role = 'list';

alter table public.media_assets enable row level security;
alter table public.media_variants enable row level security;
alter table public.media_usages enable row level security;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'media-assets',
  'media-assets',
  true,
  8388608,
  array['image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
