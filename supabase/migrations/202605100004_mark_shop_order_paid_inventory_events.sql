create or replace function public.mark_shop_order_paid(
  p_order_id uuid,
  p_payment_id text,
  p_transaction_id text default null,
  p_raw_payload jsonb default '{}'::jsonb
)
returns table (
  order_id uuid,
  order_number text,
  already_paid boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.shop_orders%rowtype;
  v_already_paid boolean;
  v_item record;
  v_product public.shop_products%rowtype;
  v_remaining_stock integer;
  v_shortfall boolean;
begin
  select *
  into v_order
  from public.shop_orders
  where id = p_order_id
    and portone_payment_id = p_payment_id
  for update;

  if not found then
    raise exception 'order not found for payment id';
  end if;

  v_already_paid := v_order.payment_status = 'paid';

  insert into public.shop_payments (
    order_id,
    provider,
    provider_payment_id,
    provider_transaction_id,
    status,
    amount_krw,
    raw_payload
  )
  values (
    v_order.id,
    'portone',
    p_payment_id,
    p_transaction_id,
    'paid',
    v_order.total_krw,
    coalesce(p_raw_payload, '{}'::jsonb)
  )
  on conflict (provider, provider_payment_id) do update set
    provider_transaction_id = excluded.provider_transaction_id,
    status = excluded.status,
    amount_krw = excluded.amount_krw,
    raw_payload = excluded.raw_payload,
    updated_at = now();

  if not v_already_paid then
    update public.shop_orders
    set
      order_status = 'paid',
      payment_status = 'paid',
      fulfillment_status = case
        when shipping_method = 'pickup' then 'pickup_ready'
        else 'preparing'
      end,
      portone_transaction_id = p_transaction_id,
      paid_at = now()
    where id = v_order.id;

    for v_item in
      select product_id, product_title, quantity
      from public.shop_order_items
      where order_id = v_order.id
        and product_id is not null
    loop
      select *
      into v_product
      from public.shop_products
      where id = v_item.product_id
      for update;

      if found and v_product.stock_quantity is not null then
        v_shortfall := v_product.stock_quantity < v_item.quantity;
        v_remaining_stock := greatest(v_product.stock_quantity - v_item.quantity, 0);

        update public.shop_products
        set
          stock_quantity = v_remaining_stock,
          availability_status = case
            when v_remaining_stock = 0 then 'sold_out'
            else availability_status
          end
        where id = v_product.id;

        insert into public.shop_order_events (
          order_id,
          event_type,
          actor,
          payload
        )
        values (
          v_order.id,
          case
            when v_shortfall then 'inventory_stock_shortfall'
            else 'inventory_stock_decremented'
          end,
          'system',
          jsonb_build_object(
            'productId', v_product.id,
            'productTitle', coalesce(v_item.product_title, v_product.title_ko),
            'quantity', v_item.quantity,
            'previousStock', v_product.stock_quantity,
            'remainingStock', v_remaining_stock,
            'shortfall', v_shortfall
          )
        );
      end if;
    end loop;
  end if;

  insert into public.shop_order_events (
    order_id,
    event_type,
    actor,
    payload
  )
  values (
    v_order.id,
    case
      when v_already_paid then 'portone_payment_reverified'
      else 'portone_payment_paid'
    end,
    'system',
    jsonb_build_object(
      'paymentId', p_payment_id,
      'transactionId', p_transaction_id,
      'alreadyPaid', v_already_paid
    )
  );

  return query
  select v_order.id, v_order.order_number, v_already_paid;
end;
$$;

revoke all on function public.mark_shop_order_paid(uuid, text, text, jsonb)
from public, anon, authenticated;

grant execute on function public.mark_shop_order_paid(uuid, text, text, jsonb)
to service_role;
