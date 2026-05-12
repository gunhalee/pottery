alter table public.shop_orders
  drop constraint if exists shop_orders_payment_method_check;

alter table public.shop_orders
  add constraint shop_orders_payment_method_check check (
    payment_method in (
      'portone',
      'portone_card',
      'portone_transfer',
      'portone_virtual_account',
      'naver_pay',
      'bank_transfer'
    )
  );

alter table public.shop_orders
  add column if not exists virtual_account_bank_name text,
  add column if not exists virtual_account_account_number text,
  add column if not exists virtual_account_account_holder text,
  add column if not exists virtual_account_issued_at timestamptz;

alter table public.shop_cash_receipts
  drop constraint if exists shop_cash_receipts_provider_check;

alter table public.shop_cash_receipts
  add constraint shop_cash_receipts_provider_check check (provider in ('nts', 'portone'));

drop index if exists public.shop_orders_deposit_due_idx;
create index if not exists shop_orders_deposit_due_idx
on public.shop_orders (deposit_due_at)
where payment_method in ('bank_transfer', 'portone_virtual_account')
  and payment_status = 'pending';

create or replace function public.reserve_stock_for_bank_transfer_order(
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
  select *
  into v_order
  from public.shop_orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'order not found';
  end if;

  if v_order.payment_method not in ('bank_transfer', 'portone_virtual_account') then
    return;
  end if;

  if v_order.is_made_to_order or v_order.stock_reserved_at is not null then
    return;
  end if;

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
      if v_product.stock_quantity < v_item.quantity then
        raise exception 'stock shortfall for %', coalesce(v_item.product_title, v_product.title_ko);
      end if;

      v_remaining_stock := v_product.stock_quantity - v_item.quantity;

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

  update public.shop_orders
  set stock_reserved_at = now()
  where id = v_order.id;
end;
$$;

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
        when payment_method in ('portone_transfer', 'portone_virtual_account', 'bank_transfer') then total_krw
        else deposit_received_amount_krw
      end,
      deposit_confirmed_at = case
        when payment_method in ('portone_transfer', 'portone_virtual_account', 'bank_transfer') then now()
        else deposit_confirmed_at
      end,
      deposit_review_status = case
        when payment_method in ('portone_transfer', 'portone_virtual_account', 'bank_transfer') then 'matched'
        else deposit_review_status
      end,
      paid_at = now()
    where id = v_order.id;

    if v_order.stock_reserved_at is null and not v_order.is_made_to_order then
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

create or replace function public.cancel_expired_bank_transfer_order(
  p_order_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.shop_orders%rowtype;
  v_provider text;
  v_provider_payment_id text;
begin
  select *
  into v_order
  from public.shop_orders
  where id = p_order_id
    and payment_method in ('bank_transfer', 'portone_virtual_account')
  for update;

  if not found then
    return false;
  end if;

  if v_order.payment_status <> 'pending'
    or v_order.paid_at is not null
    or v_order.deposit_due_at is null
    or v_order.deposit_due_at > now()
  then
    return false;
  end if;

  perform public.release_reserved_stock_for_order(v_order.id, 'deposit_expired');

  update public.shop_orders
  set
    order_status = 'deposit_expired',
    payment_status = 'expired',
    fulfillment_status = 'canceled',
    canceled_at = now(),
    deposit_review_status = case
      when payment_method in ('bank_transfer', 'portone_virtual_account') then 'waiting'
      else deposit_review_status
    end,
    deposit_review_note = coalesce(deposit_review_note, '입금기한 만료로 자동 취소')
  where id = v_order.id;

  v_provider := case
    when v_order.payment_method = 'bank_transfer' then 'bank_transfer'
    else 'portone'
  end;
  v_provider_payment_id := coalesce(
    v_order.portone_payment_id,
    'expired-' || v_order.order_number
  );

  insert into public.shop_payments (
    order_id,
    provider,
    provider_payment_id,
    payment_method,
    status,
    amount_krw,
    raw_payload
  )
  values (
    v_order.id,
    v_provider,
    v_provider_payment_id,
    v_order.payment_method,
    'expired',
    v_order.total_krw,
    jsonb_build_object('reason', 'deposit_expired')
  )
  on conflict (provider, provider_payment_id) do update set
    payment_method = excluded.payment_method,
    status = excluded.status,
    raw_payload = excluded.raw_payload,
    updated_at = now();

  insert into public.shop_order_events (
    order_id,
    event_type,
    actor,
    payload
  )
  values (
    v_order.id,
    case
      when v_order.payment_method = 'portone_virtual_account' then 'portone_virtual_account_expired'
      else 'bank_transfer_deposit_expired'
    end,
    'system',
    jsonb_build_object(
      'depositDueAt', v_order.deposit_due_at,
      'orderNumber', v_order.order_number,
      'paymentMethod', v_order.payment_method
    )
  );

  return true;
end;
$$;

grant execute on function public.reserve_stock_for_bank_transfer_order(uuid)
to service_role;
grant execute on function public.mark_shop_order_paid(uuid, text, text, jsonb)
to service_role;
grant execute on function public.cancel_expired_bank_transfer_order(uuid)
to service_role;
