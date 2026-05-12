alter table public.shop_products
  add column if not exists plant_option_enabled boolean not null default false,
  add column if not exists plant_option_price_delta_krw integer not null default 0 check (plant_option_price_delta_krw >= 0),
  add column if not exists plant_species text,
  add column if not exists plant_care_notice text,
  add column if not exists plant_return_notice text,
  add column if not exists plant_shipping_restriction_notice text,
  add column if not exists made_to_order_available boolean not null default false,
  add column if not exists made_to_order_days_min integer not null default 30 check (made_to_order_days_min > 0),
  add column if not exists made_to_order_days_max integer not null default 45 check (made_to_order_days_max >= made_to_order_days_min),
  add column if not exists made_to_order_notice text;

alter table public.shop_orders
  drop constraint if exists shop_orders_order_status_check,
  drop constraint if exists shop_orders_payment_status_check;

alter table public.shop_orders
  add constraint shop_orders_order_status_check check (
    order_status in (
      'draft',
      'pending_payment',
      'paid',
      'preparing',
      'shipped',
      'delivered',
      'deposit_expired',
      'refund_pending',
      'canceled',
      'refunded'
    )
  ),
  add constraint shop_orders_payment_status_check check (
    payment_status in (
      'unpaid',
      'pending',
      'paid',
      'failed',
      'expired',
      'canceled',
      'refund_pending',
      'partial_refunded',
      'refunded'
    )
  );

alter table public.shop_orders
  add column if not exists payment_method text not null default 'portone' check (payment_method in ('portone', 'naver_pay', 'bank_transfer')),
  add column if not exists product_option text not null default 'plant_excluded' check (product_option in ('plant_excluded', 'plant_included')),
  add column if not exists contains_live_plant boolean not null default false,
  add column if not exists is_made_to_order boolean not null default false,
  add column if not exists made_to_order_due_min_days integer,
  add column if not exists made_to_order_due_max_days integer,
  add column if not exists made_to_order_acknowledged_at timestamptz,
  add column if not exists deposit_due_at timestamptz,
  add column if not exists depositor_name text,
  add column if not exists deposit_received_amount_krw integer check (deposit_received_amount_krw is null or deposit_received_amount_krw >= 0),
  add column if not exists deposit_confirmed_at timestamptz,
  add column if not exists deposit_review_status text not null default 'not_applicable' check (
    deposit_review_status in ('not_applicable', 'waiting', 'matched', 'underpaid', 'overpaid', 'name_mismatch', 'needs_review')
  ),
  add column if not exists deposit_review_note text,
  add column if not exists stock_reserved_at timestamptz,
  add column if not exists stock_released_at timestamptz,
  add column if not exists cash_receipt_requested boolean not null default false,
  add column if not exists cash_receipt_type text check (cash_receipt_type is null or cash_receipt_type in ('personal', 'business')),
  add column if not exists cash_receipt_identifier_type text check (
    cash_receipt_identifier_type is null or cash_receipt_identifier_type in ('phone', 'cash_receipt_card', 'business_registration')
  ),
  add column if not exists cash_receipt_identifier_encrypted text,
  add column if not exists cash_receipt_identifier_masked text,
  add column if not exists cash_receipt_status text not null default 'not_requested' check (
    cash_receipt_status in ('not_requested', 'requested', 'pending', 'issued', 'failed', 'canceled')
  ),
  add column if not exists cash_receipt_approval_number text,
  add column if not exists cash_receipt_requested_at timestamptz,
  add column if not exists cash_receipt_issued_at timestamptz;

alter table public.shop_payments
  drop constraint if exists shop_payments_provider_check,
  drop constraint if exists shop_payments_status_check;

alter table public.shop_payments
  add constraint shop_payments_provider_check check (provider in ('portone', 'bank_transfer')),
  add constraint shop_payments_status_check check (
    status in ('requested', 'pending', 'paid', 'failed', 'expired', 'canceled', 'refund_pending', 'partial_refunded', 'refunded')
  );

create table if not exists public.shop_cash_receipts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  receipt_type text not null check (receipt_type in ('personal', 'business')),
  identifier_type text not null check (identifier_type in ('phone', 'cash_receipt_card', 'business_registration')),
  identifier_masked text not null,
  amount_krw integer not null check (amount_krw >= 0),
  status text not null default 'pending' check (status in ('pending', 'issued', 'failed', 'canceled')),
  approval_number text,
  error_message text,
  provider text not null default 'nts' check (provider in ('nts')),
  requested_at timestamptz not null default now(),
  issued_at timestamptz,
  canceled_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_refund_accounts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders (id) on delete cascade,
  bank_name text not null,
  account_number_encrypted text not null,
  account_number_masked text not null,
  account_holder text not null,
  depositor_name text,
  refund_reason text,
  refund_amount_krw integer check (refund_amount_krw is null or refund_amount_krw >= 0),
  status text not null default 'needs_review' check (status in ('needs_review', 'confirmed', 'refunded', 'rejected')),
  submitted_at timestamptz not null default now(),
  confirmed_at timestamptz,
  refunded_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists shop_cash_receipts_set_updated_at on public.shop_cash_receipts;
create trigger shop_cash_receipts_set_updated_at
before update on public.shop_cash_receipts
for each row
execute function public.set_updated_at();

drop trigger if exists shop_refund_accounts_set_updated_at on public.shop_refund_accounts;
create trigger shop_refund_accounts_set_updated_at
before update on public.shop_refund_accounts
for each row
execute function public.set_updated_at();

create index if not exists shop_orders_deposit_due_idx
on public.shop_orders (deposit_due_at)
where payment_method = 'bank_transfer' and payment_status = 'pending';

create index if not exists shop_cash_receipts_order_id_idx
on public.shop_cash_receipts (order_id, created_at desc);

create index if not exists shop_refund_accounts_order_id_idx
on public.shop_refund_accounts (order_id, created_at desc);

alter table public.shop_cash_receipts enable row level security;
alter table public.shop_refund_accounts enable row level security;

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

  if v_order.payment_method <> 'bank_transfer' then
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
  select *
  into v_order
  from public.shop_orders
  where id = p_order_id
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
      v_next_stock := v_product.stock_quantity + v_item.quantity;

      update public.shop_products
      set
        stock_quantity = v_next_stock,
        availability_status = case
          when availability_status = 'sold_out' and v_next_stock > 0 then 'available'
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

  update public.shop_orders
  set stock_released_at = now()
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

create or replace function public.mark_shop_order_bank_transfer_paid(
  p_order_id uuid,
  p_provider_payment_id text,
  p_depositor_name text,
  p_deposit_amount_krw integer,
  p_deposit_confirmed_at timestamptz default now(),
  p_deposit_review_status text default 'matched',
  p_note text default null
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
    and payment_method = 'bank_transfer'
  for update;

  if not found then
    raise exception 'bank transfer order not found';
  end if;

  v_already_paid := v_order.payment_status = 'paid';

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
    'bank_transfer',
    p_provider_payment_id,
    'bank_transfer',
    'paid',
    p_deposit_amount_krw,
    jsonb_build_object(
      'depositorName', p_depositor_name,
      'depositReviewStatus', p_deposit_review_status,
      'note', p_note
    )
  )
  on conflict (provider, provider_payment_id) do update set
    amount_krw = excluded.amount_krw,
    raw_payload = excluded.raw_payload,
    status = excluded.status,
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
      depositor_name = p_depositor_name,
      deposit_received_amount_krw = p_deposit_amount_krw,
      deposit_confirmed_at = p_deposit_confirmed_at,
      deposit_review_status = p_deposit_review_status,
      deposit_review_note = p_note,
      paid_at = p_deposit_confirmed_at
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
  else
    update public.shop_orders
    set
      depositor_name = p_depositor_name,
      deposit_received_amount_krw = p_deposit_amount_krw,
      deposit_review_status = p_deposit_review_status,
      deposit_review_note = p_note
    where id = v_order.id;
  end if;

  insert into public.shop_order_events (
    order_id,
    event_type,
    actor,
    note,
    payload
  )
  values (
    v_order.id,
    case
      when v_already_paid then 'bank_transfer_payment_reconfirmed'
      else 'bank_transfer_payment_confirmed'
    end,
    'admin',
    p_note,
    jsonb_build_object(
      'providerPaymentId', p_provider_payment_id,
      'depositorName', p_depositor_name,
      'depositAmountKrw', p_deposit_amount_krw,
      'depositReviewStatus', p_deposit_review_status,
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
begin
  select *
  into v_order
  from public.shop_orders
  where id = p_order_id
    and payment_method = 'bank_transfer'
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
    deposit_review_status = 'waiting',
    deposit_review_note = coalesce(deposit_review_note, '입금기한 만료로 자동 취소')
  where id = v_order.id;

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
    'bank_transfer',
    'expired-' || v_order.order_number,
    'bank_transfer',
    'expired',
    v_order.total_krw,
    jsonb_build_object('reason', 'deposit_expired')
  )
  on conflict (provider, provider_payment_id) do update set
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
    'bank_transfer_deposit_expired',
    'system',
    jsonb_build_object(
      'depositDueAt', v_order.deposit_due_at,
      'orderNumber', v_order.order_number
    )
  );

  return true;
end;
$$;

revoke all on function public.reserve_stock_for_bank_transfer_order(uuid)
from public, anon, authenticated;
revoke all on function public.release_reserved_stock_for_order(uuid, text)
from public, anon, authenticated;
revoke all on function public.mark_shop_order_paid(uuid, text, text, jsonb)
from public, anon, authenticated;
revoke all on function public.mark_shop_order_bank_transfer_paid(uuid, text, text, integer, timestamptz, text, text)
from public, anon, authenticated;
revoke all on function public.cancel_expired_bank_transfer_order(uuid)
from public, anon, authenticated;

grant execute on function public.reserve_stock_for_bank_transfer_order(uuid)
to service_role;
grant execute on function public.release_reserved_stock_for_order(uuid, text)
to service_role;
grant execute on function public.mark_shop_order_paid(uuid, text, text, jsonb)
to service_role;
grant execute on function public.mark_shop_order_bank_transfer_paid(uuid, text, text, integer, timestamptz, text, text)
to service_role;
grant execute on function public.cancel_expired_bank_transfer_order(uuid)
to service_role;

alter table public.cron_run_logs
  drop constraint if exists cron_run_logs_job_name_check;

alter table public.cron_run_logs
  add constraint cron_run_logs_job_name_check check (
    job_name in ('upload_cleanup', 'order_notifications', 'bank_transfer_expiry', 'cafe24_inventory')
  );
