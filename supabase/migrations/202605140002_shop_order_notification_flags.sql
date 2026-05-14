alter table public.shop_orders
  add column if not exists notification_email_enabled boolean not null default true,
  add column if not exists notification_kakao_enabled boolean not null default true;

notify pgrst, 'reload schema';
