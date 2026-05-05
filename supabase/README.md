# Supabase setup

1. Supabase 프로젝트를 만든다.
2. SQL editor 또는 Supabase CLI로 `migrations/202605050001_shop_products.sql`을 적용한다.
3. 로컬 `.env`와 Vercel 환경 변수에 아래 값을 넣는다.

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY`는 서버 전용이다. 현재 앱은 브라우저에서 Supabase를 직접 호출하지 않으므로 `SUPABASE_ANON_KEY`는 상품 관리 흐름에 필요하지 않다.

`SUPABASE_URL`이 없으면 `NEXT_PUBLIC_SUPABASE_URL`을 대신 사용한다. service role 키는 `SUPABASE_SERVICE_ROLE_KEY` 또는 Vercel/Supabase 통합에서 제공하는 `NEXT_SECRET_SUPABASE_SERVICE_ROLE_KEY` 중 하나가 있으면 된다.

환경 변수가 없으면 앱은 `data/shop-products.json` fallback 원장을 사용한다.
