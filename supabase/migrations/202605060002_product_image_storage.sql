alter table public.shop_product_images
add column if not exists storage_path text,
add column if not exists width integer check (width is null or width > 0),
add column if not exists height integer check (height is null or height > 0);

create unique index if not exists shop_product_images_storage_path_idx
on public.shop_product_images (storage_path)
where storage_path is not null;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
  true,
  8388608,
  array['image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
