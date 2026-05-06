revoke execute on function public.save_shop_product_with_relations(jsonb, jsonb, jsonb)
from public, anon, authenticated;

revoke execute on function public.create_media_asset_with_variants(jsonb, jsonb)
from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.save_shop_product_with_relations(jsonb, jsonb, jsonb) to service_role';
    execute 'grant execute on function public.create_media_asset_with_variants(jsonb, jsonb) to service_role';
  end if;
end;
$$;
