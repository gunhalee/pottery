revoke all on table public.api_rate_limit_buckets
from public, anon, authenticated;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer)
from public, anon, authenticated;

grant execute on function public.consume_api_rate_limit(text, text, integer, integer)
to service_role;
