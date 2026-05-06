-- Legacy buckets are removed through the Supabase Storage API after the
-- media-assets migration has copied any existing files. Direct writes to
-- storage.buckets are intentionally blocked by Supabase.
select 1;
