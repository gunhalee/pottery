create index if not exists shop_orders_pending_portone_reconcile_idx
  on public.shop_orders(updated_at)
  where payment_status = 'pending'
    and portone_payment_id is not null;
