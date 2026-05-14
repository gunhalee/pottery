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
    payment_method,
    status,
    amount_krw,
    raw_payload
  )
  values (
    v_order.id,
    'portone',
    p_payment_id,
    p_transaction_id,
    v_order.payment_method,
    'paid',
    v_order.total_krw,
    coalesce(p_raw_payload, '{}'::jsonb)
  )
  on conflict (provider, provider_payment_id) do update set
    provider_transaction_id = excluded.provider_transaction_id,
    payment_method = excluded.payment_method,
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
      deposit_received_amount_krw = case
        when payment_method in ('portone_transfer', 'portone_virtual_account') then total_krw
        else deposit_received_amount_krw
      end,
      deposit_confirmed_at = case
        when payment_method in ('portone_transfer', 'portone_virtual_account') then now()
        else deposit_confirmed_at
      end,
      deposit_review_status = case
        when payment_method in ('portone_transfer', 'portone_virtual_account') then 'matched'
        else deposit_review_status
      end,
      paid_at = now()
    where id = v_order.id;

    if v_order.stock_reserved_at is null and not v_order.is_made_to_order then
      for v_item in
        select soi.product_id, soi.product_title, soi.quantity
        from public.shop_order_items as soi
        where soi.order_id = v_order.id
          and soi.product_id is not null
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
            end,
            updated_at = now()
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
