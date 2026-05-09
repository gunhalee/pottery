do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shop_product_feedback'
      and column_name = 'kind'
  ) then
    execute 'delete from public.shop_product_feedback where kind = ''inquiry''';
  end if;
end $$;

drop index if exists public.shop_product_feedback_product_kind_status_created_idx;
drop index if exists public.shop_product_feedback_product_status_created_idx;

alter table public.shop_product_feedback
  drop constraint if exists shop_product_feedback_kind_rating_check,
  drop constraint if exists shop_product_feedback_kind_check;

alter table public.shop_product_feedback
  drop column if exists kind,
  drop column if exists is_private;

alter table public.shop_product_feedback
  alter column rating set not null;

alter table public.shop_product_feedback
  drop constraint if exists shop_product_feedback_rating_check;

alter table public.shop_product_feedback
  add constraint shop_product_feedback_rating_check check (rating between 1 and 5);

create index if not exists shop_product_feedback_product_status_created_idx
on public.shop_product_feedback (product_id, status, created_at desc);
