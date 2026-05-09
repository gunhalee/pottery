# Supabase setup

1. Supabase 프로젝트를 만든다.
2. SQL editor 또는 Supabase CLI로 `migrations/*.sql`을 파일명 순서대로 적용한다.
   구매평/문의사항 저장은 `202605090001_shop_product_feedback.sql`에서 생성되는
   `public.shop_product_feedback` 테이블을 사용한다.
   익명 찜 저장은 `202605090002_shop_wishlists.sql`에서 생성되는
   `public.shop_wishlists`, `public.shop_wishlist_items` 테이블을 사용한다.
3. 로컬 `.env`와 Vercel 환경 변수에 아래 값을 넣는다.

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY`는 서버 전용이다. 현재 앱은 브라우저에서 Supabase를 직접 호출하지 않으므로 `SUPABASE_ANON_KEY`는 상품 관리 흐름에 필요하지 않다.

`SUPABASE_URL`이 없으면 `NEXT_PUBLIC_SUPABASE_URL`을 대신 사용한다. service role 키는 `SUPABASE_SERVICE_ROLE_KEY` 또는 Vercel/Supabase 통합에서 제공하는 `NEXT_SECRET_SUPABASE_SERVICE_ROLE_KEY` 중 하나가 있으면 된다.

환경 변수가 없으면 앱은 `data/shop-products.json` fallback 원장을 사용한다.

익명 찜 기능은 서버에서 발급하는 `consepot_wishlist` httpOnly 쿠키로 브라우저를
구분한다. 계정 가입 없이 동작하지만, 브라우저/기기가 바뀌면 같은 찜 목록으로
이어지지 않는다. 쿠키 서명에는 `WISHLIST_COOKIE_SECRET`을 우선 사용하고, 값이
없으면 기존 서버 비밀값을 fallback으로 사용한다.
