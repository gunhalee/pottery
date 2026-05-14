alter table public.shop_gift_recipient_links
  add column if not exists action_url_encrypted text;

notify pgrst, 'reload schema';
