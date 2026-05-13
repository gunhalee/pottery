# 깨진 문구 감사 목록

아래 문구는 현재 코드에 남아 있는 인코딩 깨짐 후보입니다. 문구 자체는 임의로 재작성하지 않고 위치와 원문만 정리했습니다.

## 유지 코드에서 교체가 필요한 문구

- `src/lib/content-manager/content-store.ts:759`
  - `"?대? ?ъ슜 以묒씤 slug?낅땲??"`
- `src/lib/shop/product-store.ts:556`
  - `` `Supabase ?곹뭹 議고쉶 ?ㅽ뙣: ${error.message}` ``
- `src/lib/shop/product-store.ts:731`
  - `"?곹뭹 ?ㅻ챸???낅젰??二쇱꽭??"`
- `src/lib/shop/product-store.ts:746`
  - `"?곹뭹??李얠쓣 ???놁뒿?덈떎."`
- `src/lib/shop/product-store.ts:820`
  - `` `Supabase ?곹뭹 ?ш퀬 ????ㅽ뙣: ${error.message}` ``
- `src/lib/shop/product-store.ts:830`
  - `"?곹뭹??李얠쓣 ???놁뒿?덈떎."`
- `src/lib/shop/product-store.ts:839`
  - `` `Supabase ?곹뭹 ??젣 ?ㅽ뙣: ${error.message}` ``
- `src/lib/shop/product-store.ts:1300`
  - `` `${fallbackTitle.trim() || "?곹뭹"} ?대?吏` ``

## fallback 제거와 함께 사라질 문구

- `src/lib/shop/product-store.ts:864`
  - `"?대? ?ъ슜 以묒씤 slug?낅땲??"`
- `src/lib/shop/product-store.ts:894`
  - `"?곹뭹 ?ㅻ챸???낅젰??二쇱꽭??"`
- `src/lib/shop/product-store.ts:911`
  - `"?곹뭹??李얠쓣 ???놁뒿?덈떎."`
- `src/lib/shop/product-store.ts:917`
  - `"?대? ?ъ슜 以묒씤 slug?낅땲??"`
- `src/lib/shop/product-store.ts:1007`
  - `"?곹뭹??李얠쓣 ???놁뒿?덈떎."`
