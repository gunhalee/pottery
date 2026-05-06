create index if not exists content_entries_public_list_idx
on public.content_entries (kind, status, created_at desc, id);

create index if not exists content_entries_related_product_slug_idx
on public.content_entries (related_product_slug)
where related_product_slug is not null;

create index if not exists media_usages_owner_lookup_idx
on public.media_usages (owner_type, owner_id, sort_order);

create index if not exists media_usages_asset_owner_idx
on public.media_usages (asset_id, owner_type, owner_id);

create index if not exists media_variants_variant_asset_idx
on public.media_variants (variant, asset_id);
