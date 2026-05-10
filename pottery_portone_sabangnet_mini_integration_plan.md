# 포트원 + 사방넷 미니 Starter 1 주문/운영 연동 계획

- 문서 버전: v0.1
- 작성일: 2026-05-10
- 상태: Draft
- 이전 계획: `pottery_ezadmin_portone_integration_plan.md`
- 변경 전제:
  - 결제 연결은 포트원으로 진행한다.
  - 운영/주문 처리 도구는 사방넷 미니 Starter 1을 우선 사용한다.
  - 주문 관련 자체 DB는 아직 구축 전이다.
  - Cafe24 연결은 제거하는 방향이다.

## 1. 방향 전환 요약

기존 이지어드민 중심 계획은 외부 OMS/API 연동을 비교적 강하게 전제했다. 새 계획에서는 사방넷 미니 Starter 1을 사용하므로, 초기에는 API 자동화보다 `자체 주문 DB + 포트원 결제 + 사방넷 미니 운영 반영` 구조로 가볍게 시작한다.

핵심 변경점은 다음과 같다.

- 포트원은 결제 승인, 취소, 환불 검증 기준으로 유지한다.
- 자체 Supabase 주문 DB는 반드시 만든다.
- 사방넷 미니는 초기 운영 화면, 송장/배송 처리, 판매채널 확장 대비용으로 둔다.
- Starter 1에서 자체몰 API 연동이 제한될 수 있으므로, MVP는 CSV/엑셀 또는 수동 등록 경로를 먼저 확보한다.
- 사방넷 미니의 API/자동 주문수집 가능 범위는 실제 계정과 플랜에서 최종 확인 후 확장한다.

## 2. 권장 아키텍처

```text
상품 상세 / 구매 패널
  -> 자체 주문 생성 API
  -> Supabase 주문 원장
  -> 포트원 결제 요청
  -> 포트원 웹훅 수신 및 서버 검증
  -> 주문 paid 확정
  -> 사방넷 미니 반영 대기
  -> 사방넷 미니 수동/CSV/API 등록
  -> 송장/배송 상태를 자체몰 주문에 반영
```

역할 분리는 다음과 같다.

| 영역 | 기준 시스템 | 역할 |
|---|---|---|
| 상품 전시 | Supabase | 사이트 노출용 상품명, 설명, 이미지, 가격, 판매 상태 |
| 주문 원장 | Supabase | 주문번호, 주문자, 배송지, 금액, 상태, 이력 |
| 결제 검증 | 포트원 | 결제 승인, 취소, 환불, 웹훅 검증 |
| 운영 처리 | 사방넷 미니 | 주문 확인, 송장 처리, 배송 관리, 채널 확장 대비 |
| 고객 주문 조회 | 자체몰 | Supabase 주문/배송 데이터를 기반으로 표시 |

## 3. Starter 1 사용 시 주의점

사방넷 미니 공개 안내는 “온라인 판매의 첫 걸음”, “핵심 기능을 무료로 가볍게 시작”하는 라이트형 서비스에 가깝다. Starter 1은 초기 운영에는 좋지만, 자체 Next.js 쇼핑몰에서 주문을 자동으로 밀어 넣는 API 사용 가능 여부는 별도 확인이 필요하다.

따라서 현재 계획은 다음 순서가 안전하다.

1. 자체몰 주문 DB를 먼저 만든다.
2. 포트원 결제 웹훅으로 주문을 확정한다.
3. 사방넷 미니에 넣을 주문 CSV/엑셀 export를 먼저 구현한다.
4. Starter 1에서 자체몰/API 연동이 가능하면 자동 전송을 추가한다.
5. 불가능하면 상위 플랜 또는 사방넷 본 서비스/API 옵션을 검토한다.

확인해야 할 항목:

- Starter 1 월 주문 수 제한
- 상품 DB 제한
- 연동 쇼핑몰 수 제한
- 자체몰 주문 등록 방식
- API 또는 외부 주문 import 지원 여부
- 송장번호 export/import 가능 방식
- 재고 동기화 가능 방식
- 주문 취소/교환/반품 처리 가능 범위

## 4. 자체 주문 DB는 여전히 필요하다

사방넷 미니를 쓰더라도 자체 주문 DB는 생략하지 않는다.

이유:

- 포트원 웹훅 결과를 우리 DB에 저장해야 한다.
- 결제 완료 후 사방넷 미니 등록이 실패해도 주문을 잃으면 안 된다.
- 고객 주문조회는 자체몰에서 제공해야 한다.
- 사방넷 미니 플랜 변경, 도구 교체, API 제한이 있어도 주문 원장은 유지되어야 한다.
- 향후 사방넷 본 서비스, 풀필먼트, 다른 OMS로 이동할 때 마이그레이션이 쉬워진다.

## 5. 주문 상태 설계

기존 이지어드민 상태명을 사방넷 중심으로 바꾼다.

| 상태 | 의미 |
|---|---|
| `draft` | 주문 생성 전 임시 상태 |
| `payment_pending` | 포트원 결제 대기 |
| `paid` | 결제 검증 완료 |
| `sabangnet_pending` | 사방넷 미니 반영 대기 |
| `sabangnet_exported` | 사방넷 업로드용 파일 생성 완료 |
| `sabangnet_registered` | 사방넷 미니에 주문 반영 완료 |
| `preparing` | 상품 준비/출고 준비 |
| `shipped` | 송장 등록/배송 시작 |
| `delivered` | 배송 완료 |
| `cancel_requested` | 취소 요청 |
| `cancelled` | 주문 취소 완료 |
| `refund_pending` | 환불 처리 중 |
| `refunded` | 환불 완료 |
| `failed` | 결제 또는 주문 생성 실패 |

## 6. Supabase DB 설계 초안

### 6.1 `shop_orders`

주문 원장 테이블.

| 필드 | 설명 |
|---|---|
| `id` | UUID PK |
| `order_no` | 고객/운영용 주문번호. 예: `CP20260510-0001` |
| `status` | 주문 상태 |
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
| `sabangnet_status` | 사방넷 반영 상태 |
| `sabangnet_exported_at` | 사방넷 파일 생성 시각 |
| `sabangnet_registered_at` | 사방넷 등록 확인 시각 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

### 6.2 `shop_order_items`

주문 상품 테이블.

| 필드 | 설명 |
|---|---|
| `id` | UUID PK |
| `order_id` | `shop_orders.id` |
| `product_id` | `shop_products.id` |
| `product_slug` | 주문 당시 slug 스냅샷 |
| `product_title` | 주문 당시 상품명 스냅샷 |
| `sku_code` | 내부 SKU |
| `sabangnet_product_code` | 사방넷 상품코드 또는 품번 |
| `sabangnet_option_code` | 사방넷 옵션/단품 코드 |
| `quantity` | 수량 |
| `unit_price` | 단가 |
| `line_total` | 상품별 합계 |
| `created_at` | 생성 시각 |

### 6.3 `shop_payments`

포트원 결제 기록 테이블.

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
| `raw_payload` | 검증 응답 스냅샷 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

### 6.4 `shop_payment_events`

포트원 웹훅과 결제 상태 변경 이벤트 로그.

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

송장/배송 상태 테이블.

| 필드 | 설명 |
|---|---|
| `id` | UUID PK |
| `order_id` | 주문 ID |
| `carrier` | 택배사 |
| `tracking_no` | 송장번호 |
| `tracking_url` | 배송 조회 URL |
| `status` | 배송 상태 |
| `source` | `manual`, `sabangnet_csv`, `sabangnet_api` |
| `shipped_at` | 발송 시각 |
| `delivered_at` | 배송 완료 시각 |
| `raw_payload` | 반영 데이터 스냅샷 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

### 6.6 `shop_product_external_mappings`

상품별 외부 시스템 매핑.

| 필드 | 설명 |
|---|---|
| `id` | UUID PK |
| `product_id` | `shop_products.id` |
| `provider` | `sabangnet` |
| `external_product_code` | 사방넷 상품코드/품번 |
| `external_option_code` | 사방넷 단품/옵션 코드 |
| `external_sku` | 외부 SKU |
| `sync_status` | `pending`, `mapped`, `failed`, `not_applicable` |
| `last_synced_at` | 마지막 동기화 시각 |
| `last_sync_error` | 마지막 오류 |
| `created_at` | 생성 시각 |
| `updated_at` | 수정 시각 |

### 6.7 `shop_external_sync_logs`

사방넷 반영, 파일 생성, API 전송 로그.

| 필드 | 설명 |
|---|---|
| `id` | BIGINT PK |
| `provider` | `sabangnet` |
| `resource_type` | `order`, `product`, `inventory`, `shipment` |
| `resource_id` | 내부 리소스 ID |
| `action` | `export_orders`, `import_shipments`, `create_order` 등 |
| `status` | `success`, `failed`, `preview` |
| `request_payload` | 요청/파일 생성 스냅샷 |
| `response_payload` | 응답/결과 스냅샷 |
| `message` | 메시지 |
| `created_at` | 생성 시각 |

## 7. 포트원 연동 계획

포트원 쪽 계획은 기존과 동일하다.

### 7.1 환경변수

```text
PORTONE_STORE_ID=
PORTONE_CHANNEL_KEY=
PORTONE_API_SECRET=
PORTONE_WEBHOOK_SECRET=
NEXT_PUBLIC_PORTONE_STORE_ID=
NEXT_PUBLIC_PORTONE_CHANNEL_KEY=
```

### 7.2 서버 모듈

```text
src/lib/payments/portone-config.ts
src/lib/payments/portone-client.ts
src/lib/payments/portone-webhook.ts
src/lib/payments/payment-store.ts
src/app/api/payments/portone/prepare/route.ts
src/app/api/payments/portone/webhook/route.ts
```

### 7.3 결제 확정 원칙

- 클라이언트 결제 성공 콜백만 믿지 않는다.
- 포트원 웹훅을 수신한다.
- 서버에서 결제 상태와 금액을 검증한다.
- 주문 총액과 결제 금액이 다르면 확정하지 않는다.
- 같은 `paymentId`는 한 번만 최종 처리한다.

## 8. 사방넷 미니 반영 계획

### 8.1 MVP: CSV/엑셀 export 우선

Starter 1에서 API 연동 범위가 불명확하므로 MVP는 파일 기반으로 시작한다.

관리자 주문 목록에 추가할 기능:

- 결제 완료 주문 조회
- 사방넷 반영 대기 주문 필터
- 사방넷 업로드용 CSV/엑셀 export
- export 완료 처리
- 사방넷 등록 완료 수동 체크
- 송장번호 CSV import 또는 수동 입력

파일에 포함할 항목:

- 주문번호
- 주문일시
- 결제일시
- 주문자 이름
- 주문자 연락처
- 주문자 이메일
- 수령인 이름
- 수령인 연락처
- 우편번호
- 주소
- 배송메모
- 상품명
- 내부 SKU
- 사방넷 상품코드/옵션코드
- 수량
- 상품금액
- 배송비
- 총 결제금액
- 결제수단
- 포트원 paymentId

### 8.2 2단계: 사방넷 미니 계정 확인 후 자동화

사방넷 미니 계정에서 다음이 확인되면 자동화를 검토한다.

- 자체몰 주문 API 등록 가능
- 외부 주문 import API 제공
- 송장 조회/export 자동화 가능
- 재고 조회 또는 상품코드 기준 재고 동기화 가능
- Starter 1에서 API 사용 가능 또는 유료 플랜 필요 여부

자동화가 가능하면 다음 모듈을 추가한다.

```text
src/lib/sabangnet/config.ts
src/lib/sabangnet/client.ts
src/lib/sabangnet/order-export.ts
src/lib/sabangnet/order-sync.ts
src/lib/sabangnet/shipment-sync.ts
src/lib/sabangnet/inventory-sync.ts
```

## 9. 재고 정책

초기에는 Supabase를 사이트 표시 재고 기준으로 둔다.

이유:

- 자체몰 결제 전 재고 확인이 필요하다.
- 사방넷 미니 Starter 1의 재고 API 사용 가능 여부가 불확실하다.
- 소량 작업물은 동시 구매 방어가 더 중요하다.

초기 권장:

- `shop_products.stock_quantity` 또는 기존 상품 재고 필드를 화면 표시 기준으로 사용한다.
- 결제 준비 시 재고 예약 또는 재고 재검증을 수행한다.
- 사방넷 미니에는 운영상 재고 확인/송장 처리를 반영한다.
- API 가능성이 확인되면 사방넷 재고를 보조 동기화한다.

## 10. 주문 조회

회원가입은 피하는 방향을 유지한다.

주문 조회 방식:

- 주문번호 + 연락처
- 또는 주문번호 + 이메일
- 또는 주문별 조회 토큰

주문 상태는 자체 DB에서 보여준다.

- 결제 대기
- 결제 완료
- 상품 준비 중
- 발송 완료
- 배송 완료
- 취소/환불 처리 중

송장번호는 초기에는 관리자 수동 입력 또는 CSV import로 반영한다.

## 11. 관리자 화면 계획

### 11.1 주문 목록

필요 항목:

- 주문번호
- 주문일시
- 주문자
- 상품 요약
- 결제 상태
- 사방넷 반영 상태
- 배송 상태
- 총 결제금액

필터:

- 결제 상태
- 사방넷 반영 상태
- 배송 상태
- 기간
- 상품

### 11.2 주문 상세

필요 영역:

- 주문 기본 정보
- 주문자/수령인 정보
- 상품 목록
- 결제 정보
- 사방넷 반영 정보
- 배송/송장 정보
- 상태 변경 로그
- 관리자 메모

액션:

- 결제 상태 재조회
- 사방넷 export 대상에 포함
- 사방넷 등록 완료 표시
- 송장번호 입력
- 취소/환불 처리

### 11.3 사방넷 export 화면

필요 기능:

- export 대상 주문 선택
- CSV/엑셀 다운로드
- 다운로드 이력 기록
- export 완료 상태 처리
- 사방넷 업로드 형식 변경에 대비한 매핑 설정

## 12. 구현 단계

### Phase 0. 외부 준비

- 사방넷 미니 Starter 1 계정 생성
- Starter 1 요금제 제한 확인
- 자체몰 주문을 사방넷에 넣는 방식 확인
- 포트원 테스트 상점 설정
- 택배사/송장 처리 방식 확인
- 주문번호 규칙 확정

완료 기준:

- 사방넷 미니에 테스트 주문을 수동 또는 파일로 등록할 수 있다.
- 포트원 테스트 결제 호출이 가능하다.

### Phase 1. Cafe24 제거

- Cafe24 라이브러리 제거
- Cafe24 API route 제거
- Cafe24 주문조회 제거
- Cafe24 상품 매핑 UI 제거
- Cafe24 env 제거
- 최신 Supabase 스키마에서 Cafe24 테이블 제거

완료 기준:

- 런타임 코드에서 `cafe24`, `Cafe24`, `CAFE24` 참조가 사라진다.

### Phase 2. 주문 DB 구축

- `shop_orders`
- `shop_order_items`
- `shop_payments`
- `shop_payment_events`
- `shop_shipments`
- `shop_order_status_logs`
- `shop_product_external_mappings`
- `shop_external_sync_logs`

완료 기준:

- 서버에서 `payment_pending` 주문을 생성할 수 있다.
- 관리자에서 주문을 조회할 수 있다.

### Phase 3. 포트원 결제 연결

- 결제 준비 API 작성
- 결제창 호출에 필요한 데이터 반환
- 포트원 웹훅 route 작성
- 결제 상태 검증
- 주문 `paid` 확정

완료 기준:

- 테스트 결제 성공 시 자체 주문이 `paid`가 된다.
- 중복 웹훅에도 중복 처리되지 않는다.

### Phase 4. 사방넷 미니 export 구현

- 사방넷 상품코드/옵션코드 수동 매핑
- 결제 완료 주문 CSV/엑셀 export
- export 이력 저장
- export 완료 상태 저장
- 송장번호 수동 입력 또는 CSV import

완료 기준:

- 결제 완료 주문을 사방넷 미니에 넣을 수 있는 파일로 내려받을 수 있다.
- 사방넷에서 생성한 송장번호를 자체 주문에 반영할 수 있다.

### Phase 5. 주문 조회 자체화

- Cafe24 주문조회 제거
- 자체 주문번호 + 연락처 조회 구현
- 결제/배송/송장 상태 표시

완료 기준:

- 고객이 자체몰에서 주문 상태를 조회할 수 있다.

### Phase 6. 자동화 확장

사방넷 미니 또는 상위 플랜에서 API 가능성이 확인되면 다음을 진행한다.

- 주문 자동 전송
- 송장 자동 동기화
- 재고 자동 동기화
- 취소/반품 상태 동기화

## 13. MVP 범위

첫 구현에 반드시 포함할 것:

- Cafe24 런타임 제거
- 주문 DB
- 포트원 테스트 결제
- 포트원 웹훅 검증
- 관리자 주문 목록/상세
- 사방넷 상품코드 수동 매핑
- 사방넷 업로드용 주문 CSV/엑셀 export
- 송장번호 수동 입력 또는 CSV import
- 자체 주문조회

첫 구현에서 미뤄도 되는 것:

- 사방넷 API 자동 전송
- 재고 자동 동기화
- 사방넷 송장 자동 조회
- 교환/반품 자동 처리
- 문자/알림톡 자동 발송
- 회원 계정 기반 주문내역

## 14. 위험 요소와 대응

| 위험 | 대응 |
|---|---|
| Starter 1에서 자체몰 API가 불가할 수 있음 | CSV/엑셀 export를 MVP로 둔다 |
| 사방넷 업로드 양식이 변경될 수 있음 | export 매핑 레이어를 분리한다 |
| 포트원 결제 성공 후 사방넷 반영 실패 | 자체 주문 DB에 `sabangnet_pending`으로 보존한다 |
| 소량 재고 동시 구매 | 결제 준비 또는 웹훅 확정 시 재고 예약/검증 |
| 송장 상태 반영 지연 | 관리자 수동 입력/CSV import 먼저 제공 |
| 사방넷 상위 플랜 전환 가능성 | provider를 `sabangnet`으로 일반화하고 API 전환 여지를 둔다 |

## 15. 즉시 결정할 항목

- 사방넷 미니 Starter 1에서 사용할 실제 주문 등록 방식
- 사방넷 상품코드/옵션코드 규칙
- 주문 export 파일 포맷
- 송장번호를 수동 입력할지 CSV import할지
- 포트원 PG 심사 일정
- 주문번호 규칙
- 재고 예약을 MVP에 포함할지 여부

## 16. 참고 자료

- 사방넷 미니 공식 사이트: https://www.sbmini.co.kr/
- 사방넷 미니 상담/제휴 페이지: https://www.sbmini.co.kr/html/consult.html
- 사방넷 미니 제휴 문의 페이지: https://www.sbmini.co.kr/html/consult_partner.html
- 사방넷 풀필먼트 연동 매뉴얼: https://www.sbfulfillment.co.kr/manual/connect
- 사방넷 풀필먼트 개발 가이드: https://www.sbfulfillment.co.kr/developers/ver2
- 포트원 개발자 문서: https://developers.portone.io/
