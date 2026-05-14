drop function if exists public.save_shop_product_with_relations(jsonb, jsonb, jsonb);

revoke all on function public.save_shop_product_with_relations(jsonb, jsonb) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.save_shop_product_with_relations(jsonb, jsonb) to service_role';
  end if;
end;
$$;
