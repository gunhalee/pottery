# Consepot x Cafe24 headless commerce scope

작성일: 2026-05-05

## 이번 구현 범위

Consepot을 상품 원장으로 둔다. 상품명, 설명, 가격, 재고, 판매 상태, 공개 여부는 본 사이트 관리자에서 입력한다.

Cafe24는 결제와 주문 처리 엔진으로 사용한다. Toss는 Cafe24 결제수단 또는 PG 설정에 포함되는 것으로 보고, Consepot에서 Toss API를 직접 호출하지 않는다.

관리자 기능은 단일 운영자 비밀번호 로그인으로 시작한다. `ADMIN_PASSWORD` 또는 `ADMIN_PASSWORD_SHA256` 환경 변수가 없으면 로그인 폼은 비활성화된다.

Cafe24 동기화는 수동 버튼으로 시작한다. 현재 구현은 상품 생성/수정, 판매 상태, 가격, 최소 설명, 기본 카테고리, 기본 품목 재고 동기화를 목표로 한다.

상품 이미지는 아직 파일 업로드 UI를 만들지 않았다. 후속 단계에서 Consepot 이미지에 `cafe24ImagePath` 또는 업로드 결과 경로가 있을 때 최소 대표 이미지만 Cafe24에 붙인다.

## Cafe24 API 확인 범위

공식 Cafe24 Admin API에는 상품 생성/수정 엔드포인트가 있다.

- `POST /api/v2/admin/products`
- `PUT /api/v2/admin/products/{product_no}`
- `GET /api/v2/admin/products/{product_no}/variants`
- `PUT /api/v2/admin/products/{product_no}/variants/{variant_code}/inventories`

상품 생성에는 `product_name`, `price`, `supply_price`가 핵심 필수값이다. 재고는 상품 자체가 아니라 품목/재고 리소스로 분리해서 다루는 구조다.

## 보류 또는 제외

Consepot 내부에서 Cafe24 일반 고객 주문서를 직접 생성하는 흐름은 아직 구현하지 않는다. 공개 문서 기준으로 일반 쇼핑몰 고객 주문 생성 API가 명확하지 않아, 먼저 Cafe24 상품 동기화 후 Cafe24 상품/주문 화면으로 이동하는 안전한 경로를 둔다.

Cafe24 장바구니/주문서 직행 POC는 다음 단계다. 가능한 후보는 Front API 장바구니 생성 후 Cafe24 주문 화면으로 redirect하는 방식이며, Cafe24 스킨 내부 함수나 `/exec/front/order/basket/` POST를 그대로 흉내내는 방식은 공식 지원 여부를 더 확인하기 전까지 보류한다.

Supabase/Postgres 영구 저장소를 상품 원장으로 사용한다. 마이그레이션 파일은 `supabase/migrations/202605050001_shop_products.sql`에 둔다. `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있으면 관리자와 공개 Shop은 Supabase를 우선 사용한다.

`data/shop-products.json` 파일은 로컬 fallback과 seed 참고용으로 보관한다. Supabase 환경 변수가 없을 때만 읽고 쓴다.

상품 이미지 업로드, Cafe24 이미지 업로드, 토큰 자동 갱신, 옵션 상품, 주문/배송 상태 역동기화, Cafe24 주문 완료 후 Consepot 복귀 UX는 후속 범위다.
