create index if not exists content_entries_related_public_idx
on public.content_entries (
  related_product_slug,
  kind,
  status,
  created_at desc
)
where related_product_slug is not null;
