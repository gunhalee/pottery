-- Remove bootstrapping sample rows now that the site is operated from real admin-managed content.
-- Keep the migration idempotent so existing environments can apply it safely after earlier seed migrations.

delete from public.media_usages
where owner_type = 'product'
  and owner_id in (
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000003'::uuid
  );

delete from public.shop_products
where id in (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid
);

delete from public.media_usages
where owner_type = 'content_entry'
  and owner_id in (
    '10000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000002'::uuid,
    '10000000-0000-0000-0000-000000000101'::uuid
  );

delete from public.content_entries
where id in (
  '10000000-0000-0000-0000-000000000001'::uuid,
  '10000000-0000-0000-0000-000000000002'::uuid,
  '10000000-0000-0000-0000-000000000101'::uuid
);
