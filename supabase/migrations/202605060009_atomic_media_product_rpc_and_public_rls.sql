create or replace function public.save_shop_product_with_relations(
  product_row jsonb,
  cafe24_row jsonb default null,
  media_usage_rows jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
begin
  if product_row is null or jsonb_typeof(product_row) <> 'object' then
    raise exception 'product_row must be a JSON object';
  end if;

  v_product_id := (product_row->>'id')::uuid;

  insert into public.shop_products (
    id,
    availability_status,
    care_note,
    category,
    created_at,
    currency,
    glaze,
    is_archived,
    is_limited,
    kind,
    limited_type,
    material,
    price_krw,
    published,
    published_at,
    restock_cta_type,
    shipping_note,
    short_description,
    size,
    slug,
    stock_quantity,
    story,
    story_json,
    story_text,
    title_ko,
    updated_at,
    usage_note
  )
  values (
    v_product_id,
    product_row->>'availability_status',
    nullif(product_row->>'care_note', ''),
    product_row->>'category',
    coalesce(nullif(product_row->>'created_at', '')::timestamptz, now()),
    coalesce(nullif(product_row->>'currency', ''), 'KRW'),
    nullif(product_row->>'glaze', ''),
    (product_row->>'is_archived')::boolean,
    (product_row->>'is_limited')::boolean,
    product_row->>'kind',
    nullif(product_row->>'limited_type', ''),
    nullif(product_row->>'material', ''),
    nullif(product_row->>'price_krw', '')::integer,
    (product_row->>'published')::boolean,
    nullif(product_row->>'published_at', '')::date,
    nullif(product_row->>'restock_cta_type', ''),
    nullif(product_row->>'shipping_note', ''),
    product_row->>'short_description',
    nullif(product_row->>'size', ''),
    product_row->>'slug',
    nullif(product_row->>'stock_quantity', '')::integer,
    nullif(product_row->>'story', ''),
    coalesce(
      product_row->'story_json',
      '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}'::jsonb
    ),
    coalesce(product_row->>'story_text', ''),
    product_row->>'title_ko',
    coalesce(nullif(product_row->>'updated_at', '')::timestamptz, now()),
    nullif(product_row->>'usage_note', '')
  )
  on conflict (id) do update set
    availability_status = excluded.availability_status,
    care_note = excluded.care_note,
    category = excluded.category,
    currency = excluded.currency,
    glaze = excluded.glaze,
    is_archived = excluded.is_archived,
    is_limited = excluded.is_limited,
    kind = excluded.kind,
    limited_type = excluded.limited_type,
    material = excluded.material,
    price_krw = excluded.price_krw,
    published = excluded.published,
    published_at = excluded.published_at,
    restock_cta_type = excluded.restock_cta_type,
    shipping_note = excluded.shipping_note,
    short_description = excluded.short_description,
    size = excluded.size,
    slug = excluded.slug,
    stock_quantity = excluded.stock_quantity,
    story = excluded.story,
    story_json = excluded.story_json,
    story_text = excluded.story_text,
    title_ko = excluded.title_ko,
    updated_at = excluded.updated_at,
    usage_note = excluded.usage_note;

  if cafe24_row is not null and jsonb_typeof(cafe24_row) = 'object' then
    insert into public.shop_product_cafe24_mappings (
      product_id,
      category_no,
      checkout_url,
      display_group,
      last_sync_error,
      last_synced_at,
      mapping_status,
      product_no,
      product_url,
      variant_code
    )
    values (
      v_product_id,
      nullif(cafe24_row->>'category_no', '')::integer,
      nullif(cafe24_row->>'checkout_url', ''),
      coalesce(nullif(cafe24_row->>'display_group', '')::integer, 1),
      nullif(cafe24_row->>'last_sync_error', ''),
      nullif(cafe24_row->>'last_synced_at', '')::timestamptz,
      coalesce(nullif(cafe24_row->>'mapping_status', ''), 'pending'),
      nullif(cafe24_row->>'product_no', ''),
      nullif(cafe24_row->>'product_url', ''),
      nullif(cafe24_row->>'variant_code', '')
    )
    on conflict (product_id) do update set
      category_no = excluded.category_no,
      checkout_url = excluded.checkout_url,
      display_group = excluded.display_group,
      last_sync_error = excluded.last_sync_error,
      last_synced_at = excluded.last_synced_at,
      mapping_status = excluded.mapping_status,
      product_no = excluded.product_no,
      product_url = excluded.product_url,
      variant_code = excluded.variant_code
    where (
      shop_product_cafe24_mappings.category_no,
      shop_product_cafe24_mappings.checkout_url,
      shop_product_cafe24_mappings.display_group,
      shop_product_cafe24_mappings.last_sync_error,
      shop_product_cafe24_mappings.last_synced_at,
      shop_product_cafe24_mappings.mapping_status,
      shop_product_cafe24_mappings.product_no,
      shop_product_cafe24_mappings.product_url,
      shop_product_cafe24_mappings.variant_code
    ) is distinct from (
      excluded.category_no,
      excluded.checkout_url,
      excluded.display_group,
      excluded.last_sync_error,
      excluded.last_synced_at,
      excluded.mapping_status,
      excluded.product_no,
      excluded.product_url,
      excluded.variant_code
    );
  end if;

  delete from public.media_usages
  where owner_type = 'product'
    and owner_id = v_product_id;

  if media_usage_rows is not null
    and jsonb_typeof(media_usage_rows) = 'array'
    and jsonb_array_length(media_usage_rows) > 0 then
    insert into public.media_usages (
      alt_override,
      asset_id,
      caption_override,
      layout,
      owner_id,
      owner_type,
      role,
      sort_order
    )
    select
      nullif(usage_row.alt_override, ''),
      usage_row.asset_id,
      nullif(usage_row.caption_override, ''),
      nullif(usage_row.layout, ''),
      v_product_id,
      'product',
      usage_row.role,
      usage_row.sort_order
    from jsonb_to_recordset(media_usage_rows) as usage_row(
      alt_override text,
      asset_id uuid,
      caption_override text,
      layout text,
      role text,
      sort_order integer
    );
  end if;

  return v_product_id;
end;
$$;

create or replace function public.create_media_asset_with_variants(
  asset_row jsonb,
  variant_rows jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset_id uuid;
begin
  if asset_row is null or jsonb_typeof(asset_row) <> 'object' then
    raise exception 'asset_row must be a JSON object';
  end if;

  v_asset_id := (asset_row->>'id')::uuid;

  insert into public.media_assets (
    alt,
    artwork_title,
    bucket,
    caption,
    height,
    id,
    master_path,
    mime_type,
    reserved,
    size_bytes,
    src,
    width
  )
  values (
    coalesce(asset_row->>'alt', ''),
    nullif(asset_row->>'artwork_title', ''),
    coalesce(nullif(asset_row->>'bucket', ''), 'media-assets'),
    nullif(asset_row->>'caption', ''),
    (asset_row->>'height')::integer,
    v_asset_id,
    asset_row->>'master_path',
    coalesce(nullif(asset_row->>'mime_type', ''), 'image/webp'),
    coalesce(nullif(asset_row->>'reserved', '')::boolean, false),
    nullif(asset_row->>'size_bytes', '')::integer,
    asset_row->>'src',
    (asset_row->>'width')::integer
  );

  if variant_rows is not null
    and jsonb_typeof(variant_rows) = 'array'
    and jsonb_array_length(variant_rows) > 0 then
    insert into public.media_variants (
      asset_id,
      height,
      size_bytes,
      src,
      storage_path,
      variant,
      width
    )
    select
      v_asset_id,
      variant_row.height,
      variant_row.size_bytes,
      variant_row.src,
      variant_row.storage_path,
      variant_row.variant,
      variant_row.width
    from jsonb_to_recordset(variant_rows) as variant_row(
      height integer,
      size_bytes integer,
      src text,
      storage_path text,
      variant text,
      width integer
    );
  end if;

  return v_asset_id;
end;
$$;

revoke all on function public.save_shop_product_with_relations(jsonb, jsonb, jsonb) from public;
revoke all on function public.create_media_asset_with_variants(jsonb, jsonb) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.save_shop_product_with_relations(jsonb, jsonb, jsonb) to service_role';
    execute 'grant execute on function public.create_media_asset_with_variants(jsonb, jsonb) to service_role';
  end if;
end;
$$;

create or replace function public.is_public_media_usage(
  p_owner_type text,
  p_owner_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      p_owner_type = 'product'
      and exists (
        select 1
        from public.shop_products product
        where product.id = p_owner_id
          and product.published = true
      )
    )
    or (
      p_owner_type = 'content_entry'
      and exists (
        select 1
        from public.content_entries entry
        where entry.id = p_owner_id
          and entry.status = 'published'
      )
    );
$$;

create or replace function public.is_public_media_asset(p_asset_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.media_usages usage
    where usage.asset_id = p_asset_id
      and public.is_public_media_usage(usage.owner_type, usage.owner_id)
  );
$$;

revoke all on function public.is_public_media_usage(text, uuid) from public;
revoke all on function public.is_public_media_asset(uuid) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant usage on schema public to anon';
    execute 'grant execute on function public.is_public_media_usage(text, uuid) to anon';
    execute 'grant execute on function public.is_public_media_asset(uuid) to anon';
    execute 'grant select on public.shop_products to anon';
    execute 'grant select on public.shop_product_cafe24_mappings to anon';
    execute 'grant select on public.content_entries to anon';
    execute 'grant select on public.media_assets to anon';
    execute 'grant select on public.media_variants to anon';
    execute 'grant select on public.media_usages to anon';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant usage on schema public to authenticated';
    execute 'grant execute on function public.is_public_media_usage(text, uuid) to authenticated';
    execute 'grant execute on function public.is_public_media_asset(uuid) to authenticated';
    execute 'grant select on public.shop_products to authenticated';
    execute 'grant select on public.shop_product_cafe24_mappings to authenticated';
    execute 'grant select on public.content_entries to authenticated';
    execute 'grant select on public.media_assets to authenticated';
    execute 'grant select on public.media_variants to authenticated';
    execute 'grant select on public.media_usages to authenticated';
  end if;
end;
$$;

drop policy if exists "Public can read published products" on public.shop_products;
create policy "Public can read published products"
on public.shop_products
for select
to anon, authenticated
using (published = true);

drop policy if exists "Public can read published product mappings" on public.shop_product_cafe24_mappings;
create policy "Public can read published product mappings"
on public.shop_product_cafe24_mappings
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.shop_products product
    where product.id = product_id
      and product.published = true
  )
);

drop policy if exists "Public can read published content entries" on public.content_entries;
create policy "Public can read published content entries"
on public.content_entries
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "Public can read public media usages" on public.media_usages;
create policy "Public can read public media usages"
on public.media_usages
for select
to anon, authenticated
using (public.is_public_media_usage(owner_type, owner_id));

drop policy if exists "Public can read public media assets" on public.media_assets;
create policy "Public can read public media assets"
on public.media_assets
for select
to anon, authenticated
using (
  reserved = false
  and public.is_public_media_asset(id)
);

drop policy if exists "Public can read public media variants" on public.media_variants;
create policy "Public can read public media variants"
on public.media_variants
for select
to anon, authenticated
using (public.is_public_media_asset(asset_id));
