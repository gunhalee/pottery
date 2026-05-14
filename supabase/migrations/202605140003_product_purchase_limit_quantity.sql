alter table public.shop_products
  add column if not exists purchase_limit_quantity integer check (
    purchase_limit_quantity is null
    or purchase_limit_quantity >= 0
  );

create or replace function public.save_shop_product_with_relations(
  product_row jsonb,
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
    made_to_order_available,
    made_to_order_days_max,
    made_to_order_days_min,
    made_to_order_notice,
    material,
    plant_care_notice,
    plant_option_enabled,
    plant_option_price_delta_krw,
    plant_return_notice,
    plant_shipping_restriction_notice,
    plant_species,
    price_krw,
    purchase_limit_quantity,
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
    coalesce(nullif(product_row->>'made_to_order_available', '')::boolean, false),
    coalesce(nullif(product_row->>'made_to_order_days_max', '')::integer, 45),
    coalesce(nullif(product_row->>'made_to_order_days_min', '')::integer, 30),
    nullif(product_row->>'made_to_order_notice', ''),
    nullif(product_row->>'material', ''),
    nullif(product_row->>'plant_care_notice', ''),
    coalesce(nullif(product_row->>'plant_option_enabled', '')::boolean, false),
    coalesce(nullif(product_row->>'plant_option_price_delta_krw', '')::integer, 0),
    nullif(product_row->>'plant_return_notice', ''),
    nullif(product_row->>'plant_shipping_restriction_notice', ''),
    nullif(product_row->>'plant_species', ''),
    nullif(product_row->>'price_krw', '')::integer,
    nullif(product_row->>'purchase_limit_quantity', '')::integer,
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
    made_to_order_available = excluded.made_to_order_available,
    made_to_order_days_max = excluded.made_to_order_days_max,
    made_to_order_days_min = excluded.made_to_order_days_min,
    made_to_order_notice = excluded.made_to_order_notice,
    material = excluded.material,
    plant_care_notice = excluded.plant_care_notice,
    plant_option_enabled = excluded.plant_option_enabled,
    plant_option_price_delta_krw = excluded.plant_option_price_delta_krw,
    plant_return_notice = excluded.plant_return_notice,
    plant_shipping_restriction_notice = excluded.plant_shipping_restriction_notice,
    plant_species = excluded.plant_species,
    price_krw = excluded.price_krw,
    purchase_limit_quantity = excluded.purchase_limit_quantity,
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

revoke all on function public.save_shop_product_with_relations(jsonb, jsonb) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.save_shop_product_with_relations(jsonb, jsonb) to service_role';
  end if;
end;
$$;
