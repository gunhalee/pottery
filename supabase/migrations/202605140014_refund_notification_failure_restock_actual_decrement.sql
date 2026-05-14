create or replace function public.mark_shop_order_refunded_after_notification_failure(
  p_order_id uuid,
  p_payment_id text,
  p_cancellation jsonb default '{}'::jsonb,
  p_reason text default 'gift_address_notification_failed'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_order public.shop_orders%rowtype;
  v_product public.shop_products%rowtype;
  v_restock_quantity integer;
  v_restocked boolean := false;
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

  if v_order.payment_status = 'refunded'
    and v_order.order_status = 'refunded'
  then
    return false;
  end if;

  if v_order.payment_status not in ('paid', 'refund_pending') then
    return false;
  end if;

  if v_order.stock_released_at is null
    and not v_order.is_made_to_order
  then
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
        select greatest(
          coalesce((soe.payload->>'previousStock')::integer, 0) -
          coalesce((soe.payload->>'remainingStock')::integer, 0),
          0
        )
        into v_restock_quantity
        from public.shop_order_events as soe
        where soe.order_id = v_order.id
          and soe.event_type in (
            'inventory_stock_decremented',
            'inventory_stock_reserved',
            'inventory_stock_shortfall'
          )
          and soe.payload->>'productId' = v_item.product_id::text
        order by soe.created_at desc
        limit 1;

        if v_restock_quantity is null then
          v_restock_quantity := v_item.quantity;
        end if;

        if v_restock_quantity > 0 then
          v_next_stock := v_product.stock_quantity + v_restock_quantity;

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
              'quantity', v_restock_quantity,
              'orderedQuantity', v_item.quantity,
              'previousStock', v_product.stock_quantity,
              'nextStock', v_next_stock,
              'reason', p_reason
            )
          );

          v_restocked := true;
        end if;
      end if;
    end loop;
  end if;

  update public.shop_orders as so
  set
    canceled_at = coalesce(so.canceled_at, now()),
    fulfillment_status = 'canceled',
    order_status = 'refunded',
    payment_status = 'refunded',
    stock_released_at = case
      when so.stock_released_at is null
        and not so.is_made_to_order
      then now()
      else so.stock_released_at
    end,
    cash_receipt_status = case
      when so.cash_receipt_status in ('requested', 'pending', 'issued') then 'canceled'
      else so.cash_receipt_status
    end
  where so.id = v_order.id;

  update public.shop_payments as sp
  set
    raw_payload = coalesce(sp.raw_payload, '{}'::jsonb) || jsonb_build_object(
      'autoRefundCancellation',
      p_cancellation
    ),
    status = 'refunded',
    updated_at = now()
  where sp.provider = 'portone'
    and sp.provider_payment_id = p_payment_id;

  update public.shop_gift_recipient_links as sgrl
  set status = 'canceled'
  where sgrl.order_id = v_order.id
    and sgrl.status = 'pending';

  insert into public.shop_order_events (
    order_id,
    event_type,
    actor,
    payload
  )
  values (
    v_order.id,
    'gift_address_request_auto_refunded',
    'system',
    jsonb_build_object(
      'paymentId', p_payment_id,
      'reason', p_reason,
      'restocked', v_restocked,
      'cancellation', p_cancellation
    )
  );

  return true;
end;
$$;
