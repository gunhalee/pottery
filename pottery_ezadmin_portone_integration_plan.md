# 이지어드민 중심 주문/결제/운영 연동 계획

> 상태: 참고용으로 보존
>
> 2026-05-10 기준 운영 계획이 `포트원 + 사방넷 미니 Starter 1`로 변경되었다.
> 최신 계획은 `pottery_portone_sabangnet_mini_integration_plan.md`를 기준으로 한다.

- 문서 버전: v0.1
- 작성일: 2026-05-09
- 상태: Draft
- 대상 프로젝트: 콩새와 도자기공방 / 크룬프로젝트 자체몰
- 전제:
  - 결제 연결은 포트원으로 진행한다.
  - 자체몰의 결제/주문 접수 기록용 데이터베이스는 아직 구축 전이다.
  - Cafe24 연결은 제거하는 방향이다.
  - 이지어드민은 운영 기준 주문 DB와 주문 처리, 재고, 출고, 송장 운영의 중심 시스템으로 둔다.

## 1. 목적

이 문서는 자체몰의 상품 구매 흐름을 포트원 결제와 이지어드민 운영 시스템에 연결하기 위한 상세 구현 계획이다.

핵심 방향은 다음과 같다.

- 우리 사이트가 고객 경험과 결제/주문 접수 기록을 가진다.
- 포트원이 결제 승인, 취소, 환불의 검증 기준이 된다.
- 이지어드민은 결제 완료 주문의 운영 기준 DB이며, 주문 처리, 재고, 송장, 배송 상태 관리에 사용한다.
- Supabase는 포트원과 이지어드민 사이에서 결제 검증, 전송 실패 복구, 고객 주문조회에 필요한 최소 기록과 캐시를 보관한다.

## 2. 권장 아키텍처

```text
상품 상세 / 구매 패널
  -> 자체 주문 접수 API
  -> Supabase 결제/주문 접수 기록
  -> 포트원 결제 요청
  -> 포트원 웹훅 수신 및 서버 검증
  -> 접수 기록 paid 확정
  -> 이지어드민 운영 주문 전송
  -> 이지어드민 운영 주문 생성 및 재고/출고/송장 처리
  -> 자체몰 배송 상태 캐시/조회/표시
```

역할 분리는 다음과 같다.

| 영역 | 기준 시스템 | 역할 |
|---|---|---|
| 상품 전시 | Supabase | 사이트 노출용 상품명, 설명, 이미지, 가격, 판매 상태 |
| 결제/주문 접수 기록 | Supabase | 포트원 결제 검증, 이지어드민 전송 상태, 고객 주문조회용 최소 스냅샷 |
| 결제 검증 | 포트원 | 결제 승인, 취소, 환불, 웹훅 |
| 운영 주문 DB | 이지어드민 | 결제 완료 주문의 운영 기준 데이터, 주문 처리, 재고, 출고, 송장, 배송 관리 |
| 고객 주문 조회 | 자체몰 | Supabase 기록/캐시를 기반으로 표시하고 필요 시 이지어드민 최신 상태를 반영 |

## 3. 현재 코드 기준 출발점

현재 확인된 상태는 다음과 같다.

- `src/lib/payments/index.ts`는 아직 비어 있다.
- 포트원 결제 도메인은 아직 구현되지 않았다.
- 결제/주문 접수 기록 테이블은 아직 없다.
- 상품, 찜, 구매평 관련 Supabase 구조는 일부 존재한다.
- Cafe24 관련 연결 준비가 남아 있다.
  - `src/lib/cafe24/*`
  - `src/app/api/cafe24/*`
  - `src/app/api/orders/lookup/route.ts`
  - `src/components/shop/cafe24-cart-action.tsx`
  - `src/components/shop/cart-return-notice.tsx`
  - `src/components/shop/order-lookup-form.tsx`
  - 상품 모델/스토어의 Cafe24 매핑 필드
  - Cafe24 관련 Supabase 테이블과 마이그레이션

따라서 구현은 Cafe24 제거, 결제/주문 접수 기록 신설, 이지어드민 운영 주문 연동을 같은 큰 흐름 안에서 처리해야 한다.

## 4. 핵심 원칙

### 4.1 운영 주문 DB는 이지어드민, 자체 DB는 안전장치로 둔다

이지어드민을 운영 기준 주문 DB로 둔다. 다만 포트원 결제와 이지어드민 주문 생성 사이의 비동기 구간을 안전하게 다루기 위해, 자체몰에는 결제/주문 접수 기록과 연동 로그를 최소한으로 보관한다.

이유:

- 포트원 결제 검증 결과와 웹훅 처리 이력을 자체몰에도 보관해야 한다.
- 결제 성공 후 이지어드민 API 장애가 발생해도 주문 접수 기록을 잃지 않아야 한다.
- 고객 주문조회, 결제 상태 재조회, 이지어드민 재전송, 환불 이력 표시를 자체몰에서 처리할 수 있어야 한다.
- 운영 상태, 재고, 출고, 송장, 배송 완료 판단은 이지어드민을 기준으로 삼는다.

### 4.2 결제 확정은 웹훅과 서버 검증으로 처리한다

클라이언트의 결제 성공 콜백만으로 주문을 확정하지 않는다.

확정 조건:

- 포트원 웹훅이 수신된다.
- 웹훅 서명이 검증된다.
- 서버에서 결제 단건 조회 또는 검증 절차를 수행한다.
- 결제 금액이 자체몰 접수 기록의 총액과 일치한다.
- 결제 상태가 성공 상태다.
- 이미 처리된 결제가 아닌지 멱등성 검사를 통과한다.

### 4.3 이지어드민 전송 실패는 주문 실패가 아니다

포트원 결제가 성공하고 자체 접수 기록이 `paid`가 되었다면, 이지어드민 전송 실패는 주문 실패가 아니라 운영 주문 생성 실패로 다룬다.

즉:

- 자체몰 접수 기록은 보존한다.
- `ezadmin_pending` 또는 `ezadmin_failed` 상태로 남긴다.
- 관리자에서 재전송할 수 있게 한다.
- 실패 로그와 요청/응답 스냅샷을 남긴다.

## 5. 자체몰 접수 상태 설계

Supabase에 저장하는 상태값은 자체몰의 결제/접수/동기화 상태를 표현한다. 이지어드민 내부의 세부 운영 상태와 완전히 같은 의미로 쓰지 않는다.

| 상태 | 의미 |
|---|---|
| `draft` | 접수 생성 전 임시 상태 |
| `payment_pending` | 포트원 결제 대기 |
| `paid` | 결제 검증 완료 |
| `ezadmin_pending` | 이지어드민 전송 대기 |
| `ezadmin_synced` | 이지어드민 운영 주문 생성 완료 |
| `preparing` | 상품 준비/출고 준비 |
| `shipped` | 송장 등록/배송 시작 |
| `delivered` | 배송 완료 |
| `cancel_requested` | 취소 요청 |
| `cancelled` | 주문 취소 완료 |
| `refund_pending` | 환불 처리 중 |
| `refunded` | 환불 완료 |
| `failed` | 결제 또는 접수 생성 실패 |

상태 변경은 별도 로그 테이블에 모두 남긴다.

## 6. Supabase 보조 DB 설계 초안

이 DB는 운영 기준 주문 DB가 아니다. 포트원 결제 검증, 이지어드민 주문 생성 전후의 유실 방지, 고객 주문조회, 관리자 재전송/재조회에 필요한 최소 기록과 캐시를 저장한다. 운영 처리는 이지어드민 데이터를 기준으로 한다.

### 6.1 `shop_orders`

결제/주문 접수 헤더 테이블. 이지어드민 주문 생성 전에는 결제 안전장치 역할을 하고, 생성 후에는 이지어드민 주문 ID와 고객 조회용 스냅샷을 보관한다.

필드 초안:

| 필드 | 설명 |
|---|---|
| `id` | UUID PK |
| `order_no` | 고객/운영용 주문번호. 예: `CP20260509-0001` |
| `status` | 자체몰 접수/결제/동기화 상태 |
| `customer_name` | 주문자 이름 |
| `customer_phone` | 주문자 연락처 |
| `customer_email` | 주문자 이메일 |
| `recipient_name` | 수령인 이름 |
| `recipient_phone` | 수령인 연락처 |
| `postcode` | 우편번호 |
| `address1` | 기본 주소 |
| `address2` | 상세 주소 |
| `shipping_memo` | 배송 요청사항 |
| `shipping_method` | `parcel`, `pickup` 등 |
| `subtotal_amount` | 상품 합계 |
| `shipping_fee` | 배송비 |
| `discount_amount` | 할인 금액 |
| `total_amount` | 최종 결제 금액 |
| `currency` | 기본 `KRW` |
| `payment_id` | 포트원 paymentId |
| `ezadmin_order_id` | 운영 기준 이지어드민 주문 식별자 |
| `ezadmin_sync_status` | 이지어드민 동기화 상태 |
| `ezadmin_synced_at` | 마지막 성공 동기화 시각 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

### 6.2 `shop_order_items`

주문 상품 스냅샷 테이블. 결제 금액 검증과 이지어드민 주문 전송 payload 생성을 위해 주문 당시 상품 정보를 보관한다.

필드 초안:

| 필드 | 설명 |
|---|---|
| `id` | UUID PK |
| `order_id` | `shop_orders.id` |
| `product_id` | `shop_products.id` |
| `product_slug` | 주문 당시 slug 스냅샷 |
| `product_title` | 주문 당시 상품명 스냅샷 |
| `sku_code` | 내부 SKU 또는 이지어드민 매핑 코드 |
| `ezadmin_product_code` | 이지어드민 상품코드 |
| `ezadmin_option_code` | 이지어드민 옵션코드 |
| `quantity` | 수량 |
| `unit_price` | 단가 |
| `line_total` | 상품별 합계 |
| `created_at` | 생성 시각 |

### 6.3 `shop_payments`

포트원 결제 기록 테이블.

필드 초안:

| 필드 | 설명 |
|---|---|
| `id` | UUID PK |
| `order_id` | 주문 ID |
| `provider` | `portone` |
| `payment_id` | 포트원 paymentId |
| `transaction_id` | 포트원 거래 식별자 |
| `status` | 결제 상태 |
| `method` | 결제수단 |
| `amount` | 결제 금액 |
| `currency` | 통화 |
| `approved_at` | 승인 시각 |
| `cancelled_at` | 취소 시각 |
| `raw_payload` | 검증된 응답 스냅샷 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

### 6.4 `shop_payment_events`

웹훅과 결제 상태 변경 이벤트 로그.

필드 초안:

| 필드 | 설명 |
|---|---|
| `id` | UUID PK |
| `order_id` | 주문 ID |
| `payment_id` | 포트원 paymentId |
| `event_type` | 웹훅 이벤트 타입 |
| `event_id` | 외부 이벤트 식별자 |
| `processed` | 처리 여부 |
| `payload` | 이벤트 원문 |
| `received_at` | 수신 시각 |
| `processed_at` | 처리 시각 |
| `error_message` | 오류 메시지 |

### 6.5 `shop_shipments`

송장/배송 상태 캐시 테이블. 이지어드민에서 조회한 송장과 배송 상태를 자체몰 주문조회에 표시하기 위해 보관한다.

필드 초안:

| 필드 | 설명 |
|---|---|
| `id` | UUID PK |
| `order_id` | 주문 ID |
| `carrier` | 택배사 |
| `tracking_no` | 송장번호 |
| `tracking_url` | 배송 조회 URL |
| `status` | 배송 상태 |
| `shipped_at` | 발송 시각 |
| `delivered_at` | 배송 완료 시각 |
| `raw_payload` | 이지어드민 응답 스냅샷 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

### 6.6 `shop_order_status_logs`

자체몰 접수/결제/동기화 상태 변경 이력.

필드 초안:

| 필드 | 설명 |
|---|---|
| `id` | UUID PK |
| `order_id` | 주문 ID |
| `from_status` | 이전 상태 |
| `to_status` | 다음 상태 |
| `reason` | 변경 사유 |
| `actor_type` | `system`, `admin`, `portone`, `ezadmin` |
| `actor_id` | 관리자 ID 등 |
| `created_at` | 생성 시각 |

### 6.7 `shop_product_external_mappings`

상품별 외부 시스템 매핑.

필드 초안:

| 필드 | 설명 |
|---|---|
| `id` | UUID PK |
| `product_id` | `shop_products.id` |
| `provider` | `ezadmin` |
| `external_product_code` | 이지어드민 상품코드 |
| `external_option_code` | 이지어드민 옵션코드 |
| `external_sku` | 외부 SKU |
| `sync_status` | `pending`, `mapped`, `failed`, `not_applicable` |
| `last_synced_at` | 마지막 동기화 시각 |
| `last_sync_error` | 마지막 오류 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

### 6.8 `shop_external_sync_logs`

이지어드민 API 전송/조회 로그.

필드 초안:

| 필드 | 설명 |
|---|---|
| `id` | BIGINT PK |
| `provider` | `ezadmin` |
| `resource_type` | `order`, `product`, `inventory`, `shipment` |
| `resource_id` | 내부 리소스 ID |
| `action` | `create_order`, `sync_inventory`, `sync_shipment` 등 |
| `status` | `success`, `failed`, `preview` |
| `request_payload` | 요청 스냅샷 |
| `response_payload` | 응답 스냅샷 |
| `message` | 메시지 |
| `created_at` | 생성 시각 |

## 7. 포트원 연동 계획

### 7.1 환경변수

예상 환경변수:

```text
PORTONE_STORE_ID=
PORTONE_CHANNEL_KEY=
PORTONE_API_SECRET=
PORTONE_WEBHOOK_SECRET=
NEXT_PUBLIC_PORTONE_STORE_ID=
NEXT_PUBLIC_PORTONE_CHANNEL_KEY=
```

공개 가능한 값과 서버 전용 secret을 분리한다.

### 7.2 서버 모듈

추가 후보:

```text
src/lib/payments/portone-config.ts
src/lib/payments/portone-client.ts
src/lib/payments/portone-webhook.ts
src/lib/payments/payment-store.ts
src/app/api/payments/portone/prepare/route.ts
src/app/api/payments/portone/webhook/route.ts
```

### 7.3 결제 준비 API

역할:

- 상품 ID와 수량을 받는다.
- 서버에서 상품 가격, 배송비, 총액을 계산한다.
- 자체몰 접수 기록을 `payment_pending` 상태로 생성한다.
- 포트원 `paymentId`로 사용할 고유 값을 만든다.
- 클라이언트가 결제창을 열 수 있는 결제/주문 접수 정보를 반환한다.

주의:

- 클라이언트에서 보낸 금액을 신뢰하지 않는다.
- 품절/판매중지 상품은 접수 기록 생성 단계에서 차단한다.
- 한정 수량 상품은 접수 생성 또는 결제 확정 시점에 수량 예약을 검토한다.

### 7.4 포트원 웹훅 API

역할:

- raw body를 기반으로 웹훅 서명을 검증한다.
- 결제 이벤트를 `shop_payment_events`에 저장한다.
- 결제 단건 조회로 실제 결제 상태를 확인한다.
- 자체몰 접수 기록의 총액과 결제 금액을 비교한다.
- 검증 성공 시 자체몰 접수 기록을 `paid`로 변경한다.
- 이지어드민 전송 작업을 시작하거나 큐 상태로 남긴다.

멱등성 기준:

- 같은 `paymentId`는 한 번만 최종 처리한다.
- 같은 웹훅 이벤트가 여러 번 와도 중복 상태 변경을 만들지 않는다.
- 결제 금액 불일치 시 접수 기록을 확정하지 않고 관리자 확인 대상으로 둔다.

## 8. 이지어드민 연동 계획

### 8.1 환경변수

예상 환경변수:

```text
EZADMIN_API_BASE_URL=
EZADMIN_PARTNER_KEY=
EZADMIN_SECRET_KEY=
EZADMIN_SHOP_ID=
EZADMIN_VENDOR_CODE=
```

정확한 키 이름과 인증 방식은 이지어드민 API 신청 후 제공되는 개발 가이드에 맞춰 확정한다.

### 8.2 서버 모듈

추가 후보:

```text
src/lib/ezadmin/config.ts
src/lib/ezadmin/client.ts
src/lib/ezadmin/order-sync.ts
src/lib/ezadmin/inventory-sync.ts
src/lib/ezadmin/shipment-sync.ts
src/app/api/cron/ezadmin-inventory/route.ts
src/app/api/cron/ezadmin-shipments/route.ts
```

### 8.3 주문 전송

전송 시점:

- 포트원 결제 검증이 끝나고 자체몰 접수 기록이 `paid`가 된 직후.

전송 데이터:

- 판매처: 자체몰
- 주문번호
- 주문일시
- 결제일시
- 주문자 이름, 연락처, 이메일
- 수령인 이름, 연락처, 주소
- 배송메모
- 상품코드, 옵션코드, 상품명, 수량
- 상품금액, 배송비, 총 결제금액
- 결제수단
- 포트원 결제 ID

성공 처리:

- `shop_orders.ezadmin_sync_status = synced`
- `shop_orders.ezadmin_order_id`에 운영 기준 주문 ID 저장
- `shop_orders.status = ezadmin_synced`
- `shop_external_sync_logs`에 성공 로그 저장

실패 처리:

- 자체몰 접수 기록은 `paid` 또는 `ezadmin_pending`으로 보존
- 실패 응답과 메시지를 로그에 저장
- 관리자 주문 상세에서 재전송 가능하게 함

### 8.4 상품/SKU 매핑

초기 전략:

- 이지어드민 상품은 운영자가 수동 등록한다.
- 우리 관리자 상품 상세에서 이지어드민 상품코드/옵션코드만 매핑한다.
- 주문 전송 시 매핑 값이 없으면 전송을 막고 관리자 확인 상태로 둔다.

추후 전략:

- 상품 API를 이용해 Supabase 상품을 이지어드민 상품으로 등록/수정한다.
- 이미지, 가격, 품절 상태, 재고경고수량까지 자동 동기화한다.

### 8.5 재고 동기화

초기 추천:

- 이지어드민을 운영 재고 기준으로 둔다.
- Supabase의 상품 재고는 화면 표시용 캐시로 사용한다.
- 주기적으로 이지어드민 재고를 조회해 Supabase에 반영한다.

Cron 후보:

```text
GET /api/cron/ezadmin-inventory
```

동기화 정책:

- 최근 판매중 상품 중심으로 조회한다.
- 한정 수량 상품은 재고 0이 되면 사이트 표시를 품절로 바꾼다.
- 동기화 실패 시 기존 재고를 즉시 지우지 않고 실패 로그만 남긴다.

### 8.6 송장/배송 동기화

Cron 후보:

```text
GET /api/cron/ezadmin-shipments
```

동기화 대상:

- 최근 30일 주문
- `ezadmin_synced`, `preparing`, `shipped` 상태 주문
- 송장 미등록 또는 배송 완료 전 주문

반영 항목:

- 택배사
- 송장번호
- 배송조회 URL
- 출고일시
- 배송상태
- 배송완료일시

## 9. 재고 예약과 동시 구매 방어

도자기 작업물은 단일 수량 또는 소량 재고가 많으므로 동시 구매 방어가 필요하다.

초기 MVP에서는 다음 중 하나를 선택한다.

### 선택 A. 결제 확정 시점 방어

- 접수 기록 생성은 허용한다.
- 포트원 결제 웹훅에서 재고를 다시 확인한다.
- 재고 부족이면 결제를 즉시 취소하고 주문을 실패 처리한다.

장점:

- 구현이 단순하다.

단점:

- 고객이 결제 성공 후 취소되는 불쾌한 경험이 생길 수 있다.

### 선택 B. 재고 예약 테이블 사용

추가 테이블:

```text
shop_stock_reservations
```

흐름:

- 결제 준비 시 재고를 예약한다.
- 예약 만료 시간을 둔다. 예: 15분.
- 결제 성공 시 예약을 확정한다.
- 결제 실패/만료 시 예약을 해제한다.

장점:

- 동시 구매 방어가 안정적이다.

단점:

- 구현량이 늘어난다.

추천:

- 단일 작업물이 많다면 선택 B를 우선 고려한다.
- 초기 구현 속도가 중요하면 선택 A로 시작하고, 바로 선택 B로 확장할 수 있게 DB 설계를 열어둔다.

## 10. 고객 주문 조회

회원가입을 피하는 방향을 유지한다.

주문 조회 방식:

- 주문번호 + 연락처
- 또는 주문번호 + 이메일
- 또는 주문별 조회 토큰

권장:

- 주문 완료 페이지와 알림 메시지에 조회 토큰이 포함된 링크를 제공한다.
- 직접 조회 화면에서는 주문번호와 연락처를 입력하게 한다.
- 조회 화면은 Supabase의 접수/배송 캐시를 우선 보여주고, 필요 시 이지어드민에서 최신 송장/배송 상태를 갱신한다.

Cafe24 주문조회 페이지는 자체 주문조회로 교체한다.

## 11. 취소/환불 정책

상태별 처리 기준:

| 상태 | 처리 |
|---|---|
| 결제 전 | 접수 기록 만료 또는 삭제 |
| 결제 완료, 이지어드민 전송 전 | 포트원 취소 후 접수 기록 취소 |
| 이지어드민 전송 후, 출고 전 | 관리자 승인 후 포트원 취소 + 이지어드민 취소 반영 |
| 송장 등록 후 | 반품/교환 흐름으로 분리 |
| 배송 완료 후 | 수동 CS 정책에 따라 처리 |

환불 로그는 `shop_payments`와 `shop_payment_events`에 모두 남긴다.

## 12. 관리자 화면 계획

### 12.1 주문 목록

자체 관리자 화면은 결제/연동 상태를 확인하고 재전송/재조회하는 보조 화면이다. 일상적인 출고/송장 운영은 이지어드민을 기준으로 한다.

필요 항목:

- 주문번호
- 주문일시
- 주문자
- 상품 요약
- 총 결제금액
- 결제 상태
- 이지어드민 전송 상태
- 배송 상태
- 관리 액션

필터:

- 자체몰 접수 상태
- 결제 상태
- 이지어드민 동기화 상태
- 배송 상태
- 기간
- 상품

### 12.2 주문 상세

필요 영역:

- 주문 기본 정보
- 주문자/수령인 정보
- 상품 목록
- 결제 정보
- 이지어드민 전송 정보
- 배송/송장 정보
- 상태 변경 로그
- 관리자 메모

액션:

- 이지어드민 재전송
- 결제 상태 재조회
- 송장 상태 재동기화
- 취소/환불 처리
- 관리자 메모 저장

### 12.3 상품 매핑 관리

상품 상세 관리자 화면에 추가:

- 이지어드민 상품코드
- 이지어드민 옵션코드
- 매핑 상태
- 마지막 동기화 결과

초기에는 수동 입력을 우선한다.

## 13. API/Route 초안

추가 후보:

```text
POST /api/orders/prepare
GET  /api/orders/[orderNo]
POST /api/payments/portone/webhook
POST /api/admin/orders/[id]/sync-ezadmin
POST /api/admin/orders/[id]/refresh-payment
POST /api/admin/orders/[id]/refresh-shipment
GET  /api/cron/ezadmin-inventory
GET  /api/cron/ezadmin-shipments
```

기존 Cafe24 주문조회 API는 제거하거나 자체 주문조회 API로 교체한다.

## 14. 구현 단계

### Phase 0. 외부 준비

- 이지어드민 API 이용 신청
- 이지어드민 보안코드/테스트 정보 확보
- 포트원 테스트 상점 설정
- PG 심사/계약 진행 범위 확인
- 택배사/배송 정책 확정
- 주문번호 규칙 확정

완료 기준:

- 테스트 환경에서 포트원 결제를 호출할 수 있다.
- 이지어드민 API 개발 가이드를 확보했다.
- 이지어드민 테스트 호출이 가능하다.

### Phase 1. Cafe24 제거

- Cafe24 라이브러리 제거
- Cafe24 API route 제거
- Cafe24 주문조회 제거
- Cafe24 상품 매핑 UI 제거
- Cafe24 관련 env 제거
- Cafe24 관련 Supabase 구조는 신규 마이그레이션으로 폐기

완료 기준:

- 런타임 코드에서 `cafe24`, `Cafe24`, `CAFE24` 참조가 사라진다.
- 과거 마이그레이션은 히스토리로 남기되, 최신 스키마에서는 Cafe24 테이블이 제거된다.

### Phase 2. 결제/주문 접수 보조 DB 구축

- `shop_orders`
- `shop_order_items`
- `shop_payments`
- `shop_payment_events`
- `shop_shipments`
- `shop_order_status_logs`
- `shop_product_external_mappings`
- `shop_external_sync_logs`

완료 기준:

- Supabase migration이 추가된다.
- 서버에서 접수 기록 draft/payment_pending을 생성할 수 있다.
- 관리자 권한으로 결제/접수/이지어드민 동기화 상태를 조회할 수 있다.

### Phase 3. 구매 패널 연결

- 상품 상세 구매 버튼을 주문 접수 흐름으로 연결
- 수량/배송방식/배송비 서버 계산으로 이전
- 결제 전 고객 정보 입력 UI 추가
- 비회원 주문 조회에 필요한 연락처/이메일 수집

완료 기준:

- 실제 결제 호출 전까지 자체몰 접수 기록이 생성된다.
- 가격과 배송비가 서버 기준으로 계산된다.

### Phase 4. 포트원 결제 연동

- 포트원 config/client 작성
- 결제 준비 API 작성
- 웹훅 route 작성
- 결제 상태 검증
- 결제 이벤트 저장
- 결제 성공 시 접수 기록 `paid` 처리

완료 기준:

- 테스트 결제 성공 시 접수 기록이 `paid`가 된다.
- 중복 웹훅이 와도 접수 기록이 중복 처리되지 않는다.
- 금액 불일치 결제는 확정되지 않는다.

### Phase 5. 이지어드민 주문 전송

- 이지어드민 client 작성
- 주문 payload 변환기 작성
- 결제 완료 접수 기록을 이지어드민 운영 주문으로 전송
- 전송 성공/실패 로그 저장
- 관리자 재전송 액션 추가

완료 기준:

- 결제 완료 주문이 이지어드민 테스트 환경에 생성된다.
- 이지어드민 전송에 실패한 접수 기록을 관리자에서 재전송할 수 있다.

### Phase 6. 재고 동기화

- 이지어드민 재고 조회 API 연결
- 내부 상품 매핑 기준으로 재고 캐시 갱신
- 판매 가능/품절 상태 반영
- cron route 추가

완료 기준:

- 이지어드민 재고가 사이트 상품 상태에 반영된다.
- 동기화 실패 로그가 남는다.

### Phase 7. 배송 동기화

- 이지어드민 송장/배송 상태 조회 연결
- `shop_shipments` 갱신
- 고객 주문조회 페이지 표시
- 관리자 주문 상세 표시

완료 기준:

- 이지어드민 송장번호가 자체몰 주문조회에 표시된다.
- 배송 완료 상태가 자체몰 접수/배송 캐시에 반영된다.

### Phase 8. 취소/환불

- 포트원 결제 취소 API 연결
- 자체몰 접수 상태와 이지어드민 운영 상태별 취소 가능 여부 구현
- 환불 이벤트 저장
- 이지어드민 전송 후 취소 정책 반영

완료 기준:

- 출고 전 주문을 관리자에서 취소/환불 처리할 수 있다.
- 결제 취소, 자체몰 접수 상태, 이지어드민 운영 상태가 일관되게 저장된다.

## 15. MVP 범위

첫 구현에 반드시 포함할 것:

- Cafe24 런타임 제거
- 결제/주문 접수 보조 DB
- 포트원 테스트 결제
- 포트원 웹훅 검증
- 이지어드민 상품코드 수동 매핑
- 결제 완료 접수 기록을 이지어드민 운영 주문으로 전송
- 관리자 주문 목록/상세 최소 기능
- 주문조회 페이지 자체화

첫 구현에서 미뤄도 되는 것:

- 이지어드민 상품 자동 등록
- 복잡한 교환/반품 자동화
- 고객 알림톡/문자 자동 발송
- 다중 배송지
- 쿠폰/포인트
- 회원 계정 기반 주문 내역
- 정산 자동화

## 16. 위험 요소와 대응

| 위험 | 대응 |
|---|---|
| 이지어드민 API 사양 확보 전 구현 범위 불확실 | 어댑터 인터페이스를 먼저 만들고 실제 client는 사양 확보 후 구현 |
| 포트원 결제 성공 후 이지어드민 전송 실패 | 자체몰 접수 기록과 결제 로그를 보존하고 재전송 큐/로그 제공 |
| 소량 재고 동시 구매 | 재고 예약 테이블 또는 결제 확정 시점 재고 검증 |
| 웹훅 중복/순서 뒤섞임 | 이벤트 로그와 멱등성 키로 처리 |
| 배송 상태 동기화 지연 | cron 기반 주기 조회 + 관리자 수동 갱신 |
| 비회원 주문조회 개인정보 노출 | 주문번호 + 연락처 검증, 조회 토큰, 응답 정보 최소화 |

## 17. 결정이 필요한 항목

- 이지어드민 상품 등록을 처음부터 자동화할지, 수동 매핑으로 시작할지
- 재고 예약 테이블을 MVP에 포함할지
- 방문수령 주문을 이지어드민에 어떤 배송 방식으로 넣을지
- 포트원 PG 선택과 심사 일정
- 고객 알림을 이메일, 카카오채널, 문자 중 어디까지 자동화할지
- 주문번호 형식
- 배송비 정책과 무료배송 조건

## 18. 참고 자료

- 이지어드민 API 안내: https://www3.ezadmin.co.kr/api/index.html
- 이지어드민 API 신청절차: https://www.ezadmin.co.kr/api/flow.html
- 이지어드민 재고할당: https://help.ezadmin.co.kr/index.php?title=%EC%9E%AC%EA%B3%A0%ED%95%A0%EB%8B%B9
- 이지어드민 재고일괄조정: https://help.ezadmin.co.kr/index.php?title=%EC%9E%AC%EA%B3%A0%EC%9D%BC%EA%B4%84%EC%A1%B0%EC%A0%95
- 포트원 V2 API: https://developers.portone.io/api/rest-v2/payment.billingKey
- 포트원 웹훅 예시: https://developers.portone.io/opi/ko/integration/cancel/v2/readme?v=v2
