create or replace function public.reserve_stock_for_virtual_account_order(
  p_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.shop_orders%rowtype;
  v_item record;
  v_product public.shop_products%rowtype;
  v_remaining_stock integer;
begin
  select so.*
  into v_order
  from public.shop_orders as so
  where so.id = p_order_id
  for update;

  if not found then
    raise exception 'order not found';
  end if;

  if v_order.payment_method <> 'portone_virtual_account' then
    return;
  end if;

  if v_order.is_made_to_order or v_order.stock_reserved_at is not null then
    return;
  end if;

  for v_item in
    select soi.product_id, soi.product_title, soi.quantity
    from public.shop_order_items as soi
    where soi.order_id = v_order.id
      and soi.product_id is not null
  loop
    select sp.*
    into v_product
    from public.shop_products as sp
    where sp.id = v_item.product_id
    for update;

    if found and v_product.stock_quantity is not null then
      if v_product.stock_quantity < v_item.quantity then
        raise exception 'stock shortfall for %', coalesce(v_item.product_title, v_product.title_ko);
      end if;

      v_remaining_stock := v_product.stock_quantity - v_item.quantity;

      update public.shop_products as sp
      set
        stock_quantity = v_remaining_stock,
        availability_status = case
          when v_remaining_stock = 0 then 'sold_out'
          else sp.availability_status
        end,
        updated_at = now()
      where sp.id = v_product.id;

      insert into public.shop_order_events (
        order_id,
        event_type,
        actor,
        payload
      )
      values (
        v_order.id,
        'inventory_stock_reserved',
        'system',
        jsonb_build_object(
          'productId', v_product.id,
          'productTitle', coalesce(v_item.product_title, v_product.title_ko),
          'quantity', v_item.quantity,
          'previousStock', v_product.stock_quantity,
          'remainingStock', v_remaining_stock
        )
      );
    end if;
  end loop;

  update public.shop_orders as so
  set stock_reserved_at = now()
  where so.id = v_order.id;
end;
$$;

create or replace function public.release_reserved_stock_for_order(
  p_order_id uuid,
  p_reason text default 'deposit_expired'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.shop_orders%rowtype;
  v_item record;
  v_product public.shop_products%rowtype;
  v_next_stock integer;
begin
  select so.*
  into v_order
  from public.shop_orders as so
  where so.id = p_order_id
  for update;

  if not found then
    raise exception 'order not found';
  end if;

  if v_order.stock_reserved_at is null
    or v_order.stock_released_at is not null
    or v_order.payment_status = 'paid'
  then
    return;
  end if;

  for v_item in
    select soi.product_id, soi.product_title, soi.quantity
    from public.shop_order_items as soi
    where soi.order_id = v_order.id
      and soi.product_id is not null
  loop
    select sp.*
    into v_product
    from public.shop_products as sp
    where sp.id = v_item.product_id
    for update;

    if found and v_product.stock_quantity is not null then
      v_next_stock := v_product.stock_quantity + v_item.quantity;

      update public.shop_products as sp
      set
        stock_quantity = v_next_stock,
        availability_status = case
          when sp.availability_status = 'sold_out' and v_next_stock > 0 then 'available'
          else sp.availability_status
        end,
        updated_at = now()
      where sp.id = v_product.id;

      insert into public.shop_order_events (
        order_id,
        event_type,
        actor,
        payload
      )
      values (
        v_order.id,
        'inventory_stock_released',
        'system',
        jsonb_build_object(
          'productId', v_product.id,
          'productTitle', coalesce(v_item.product_title, v_product.title_ko),
          'quantity', v_item.quantity,
          'previousStock', v_product.stock_quantity,
          'nextStock', v_next_stock,
          'reason', p_reason
        )
      );
    end if;
  end loop;

  update public.shop_orders as so
  set stock_released_at = now()
  where so.id = v_order.id;
end;
$$;

revoke all on function public.reserve_stock_for_virtual_account_order(uuid)
from public, anon, authenticated;

revoke all on function public.release_reserved_stock_for_order(uuid, text)
from public, anon, authenticated;

grant execute on function public.reserve_stock_for_virtual_account_order(uuid)
to service_role;

grant execute on function public.release_reserved_stock_for_order(uuid, text)
to service_role;
