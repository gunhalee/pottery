create table if not exists public.content_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('news', 'gallery')),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  summary text not null default '',
  body_json jsonb not null default '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}'::jsonb,
  body_text text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  display_date text,
  related_product_slug text,
  published_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, slug)
);

create table if not exists public.content_images (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.content_entries (id) on delete cascade,
  storage_path text not null unique,
  src text not null,
  alt text not null default '',
  caption text,
  layout text not null default 'default' check (
    layout in ('default', 'wide', 'full', 'two-column', 'align-left', 'align-right')
  ),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  is_cover boolean not null default false,
  is_detail boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists content_entries_set_updated_at on public.content_entries;
create trigger content_entries_set_updated_at
before update on public.content_entries
for each row
execute function public.set_updated_at();

drop trigger if exists content_images_set_updated_at on public.content_images;
create trigger content_images_set_updated_at
before update on public.content_images
for each row
execute function public.set_updated_at();

create index if not exists content_entries_kind_status_created_at_idx
on public.content_entries (kind, status, created_at desc);

create index if not exists content_images_entry_sort_order_idx
on public.content_images (entry_id, sort_order);

create unique index if not exists content_images_one_cover_idx
on public.content_images (entry_id)
where is_cover;

alter table public.content_entries enable row level security;
alter table public.content_images enable row level security;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'content-images',
  'content-images',
  true,
  8388608,
  array['image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into public.content_entries (
  id,
  kind,
  slug,
  title,
  summary,
  body_text,
  status,
  display_date
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'news',
    'spring-studio-note',
    '새 전시 준비 소식',
    '봄 시즌 작업물과 공방 오픈 일정을 안내합니다.',
    '봄 시즌 작업물과 공방 오픈 일정을 안내합니다.',
    'draft',
    '2026.04'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'news',
    'regular-class-open',
    '정규 클래스 모집',
    '기초 성형부터 유약 테스트까지 함께하는 수업입니다.',
    '기초 성형부터 유약 테스트까지 함께하는 수업입니다.',
    'draft',
    '2026.03'
  ),
  (
    '10000000-0000-0000-0000-000000000101',
    'gallery',
    'studio-process-archive',
    '작업 과정 / 스튜디오',
    '작업물과 작업 과정의 분위기를 기록하는 샘플 아카이브입니다.',
    '작업물과 작업 과정의 분위기를 기록하는 샘플 아카이브입니다.',
    'draft',
    '2026'
  )
on conflict (kind, slug) do nothing;
