create or replace function public.save_content_entry_with_relations(
  entry_row jsonb,
  media_usage_rows jsonb default '[]'::jsonb,
  reserved_asset_rows jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
begin
  if entry_row is null or jsonb_typeof(entry_row) <> 'object' then
    raise exception 'entry_row must be a JSON object';
  end if;

  v_entry_id := (entry_row->>'id')::uuid;

  insert into public.content_entries (
    body_json,
    body_text,
    display_date,
    id,
    kind,
    published_at,
    related_product_slug,
    slug,
    status,
    summary,
    title,
    updated_at
  )
  values (
    coalesce(
      entry_row->'body_json',
      '{"root":{"children":[],"direction":null,"format":"","indent":0,"type":"root","version":1}}'::jsonb
    ),
    coalesce(entry_row->>'body_text', ''),
    nullif(entry_row->>'display_date', ''),
    v_entry_id,
    entry_row->>'kind',
    nullif(entry_row->>'published_at', '')::date,
    nullif(entry_row->>'related_product_slug', ''),
    entry_row->>'slug',
    coalesce(nullif(entry_row->>'status', ''), 'draft'),
    coalesce(entry_row->>'summary', ''),
    entry_row->>'title',
    coalesce(nullif(entry_row->>'updated_at', '')::timestamptz, now())
  )
  on conflict (id) do update set
    body_json = excluded.body_json,
    body_text = excluded.body_text,
    display_date = excluded.display_date,
    kind = excluded.kind,
    published_at = excluded.published_at,
    related_product_slug = excluded.related_product_slug,
    slug = excluded.slug,
    status = excluded.status,
    summary = excluded.summary,
    title = excluded.title,
    updated_at = excluded.updated_at;

  if reserved_asset_rows is not null
    and jsonb_typeof(reserved_asset_rows) = 'array'
    and jsonb_array_length(reserved_asset_rows) > 0 then
    update public.media_assets asset
    set reserved = coalesce(reserved_row.reserved, false)
    from jsonb_to_recordset(reserved_asset_rows) as reserved_row(
      asset_id uuid,
      reserved boolean
    )
    where asset.id = reserved_row.asset_id;
  end if;

  delete from public.media_usages
  where owner_type = 'content_entry'
    and owner_id = v_entry_id;

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
      coalesce(nullif(usage_row.layout, ''), 'default'),
      v_entry_id,
      'content_entry',
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

  return v_entry_id;
end;
$$;

create or replace function public.delete_shop_product_with_relations(
  target_product_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_id uuid;
begin
  delete from public.media_usages
  where owner_type = 'product'
    and owner_id = target_product_id;

  delete from public.shop_products
  where id = target_product_id
  returning id into v_deleted_id;

  if v_deleted_id is null then
    raise exception 'shop product % was not found', target_product_id;
  end if;

  return v_deleted_id;
end;
$$;

create or replace function public.delete_content_entry_with_relations(
  target_entry_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_id uuid;
begin
  delete from public.media_usages
  where owner_type = 'content_entry'
    and owner_id = target_entry_id;

  delete from public.content_entries
  where id = target_entry_id
  returning id into v_deleted_id;

  if v_deleted_id is null then
    raise exception 'content entry % was not found', target_entry_id;
  end if;

  return v_deleted_id;
end;
$$;

revoke execute on function public.save_content_entry_with_relations(jsonb, jsonb, jsonb)
from public, anon, authenticated;

revoke execute on function public.delete_shop_product_with_relations(uuid)
from public, anon, authenticated;

revoke execute on function public.delete_content_entry_with_relations(uuid)
from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.save_content_entry_with_relations(jsonb, jsonb, jsonb) to service_role';
    execute 'grant execute on function public.delete_shop_product_with_relations(uuid) to service_role';
    execute 'grant execute on function public.delete_content_entry_with_relations(uuid) to service_role';
  end if;
end;
$$;
