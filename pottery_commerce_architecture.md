# 커머스 구조 기준

## 현재 기준

- 상품 원장은 Consepot 내부 상품 모델과 Supabase `shop_products`를 기준으로 둔다.
- 주문 원장은 Supabase `shop_orders`와 하위 주문 테이블을 기준으로 둔다.
- 고객 주문 조회는 주문번호, 주문자 연락처 끝 4자리, 숫자 4자리 조회 비밀번호로 처리한다.
- 결제는 PortOne 결제창 요청과 서버측 결제 단건 조회 검증을 기준으로 처리한다.
- 배송은 자체 주문 기록의 배송 상태와 송장 정보를 기준으로 운영한다.
- 찜은 비회원 쿠키 기반 식별자와 Supabase 저장소를 함께 사용한다.
- 구매평은 텍스트 리뷰와 사진 리뷰를 모두 포함하는 상품 피드백 구조를 기준으로 둔다.
- 선물하기는 주문 접수 단계부터 별도 모드로 저장하고, 수령인 배송지 입력과 알림 발송은 결제 연결 단계에서 확장한다.

## 구현된 흐름

- 상품 상세의 일반 구매, 선물하기, N pay 버튼은 `/checkout`으로 이동한다.
- `/checkout`은 상품, 수량, 배송 방법, 구매 모드를 URL 파라미터로 받아 주문자 정보를 입력받는다.
- `/api/orders/draft`는 주문 가능 상태와 재고를 확인한 뒤 주문과 주문 상품 스냅샷을 저장한다.
- `/api/payments/portone/prepare`는 주문에 PortOne `paymentId`를 연결하고 브라우저 SDK 결제 요청 데이터를 반환한다.
- `/api/payments/portone/complete`는 PortOne 결제 단건 조회 API로 결제 상태와 금액을 검증한다.
- 결제 상태가 `PAID`이고 주문 금액과 일치하면 `mark_shop_order_paid` RPC가 주문 상태를 `paid`로 바꾸고 재고를 차감한다.
- `/checkout/complete`는 모바일 redirect 결제 후 돌아오는 결제 결과를 검증한다.
- `/order/lookup`과 `/api/orders/lookup`은 자체 주문 DB를 조회한다.
- 배송비 계산은 `src/lib/orders/pricing.ts`의 공통 상수를 사용한다.

## 환경변수

- `NEXT_PUBLIC_PORTONE_STORE_ID`: PortOne 상점 ID.
- `NEXT_PUBLIC_PORTONE_CHANNEL_KEY`: 사용할 PortOne 채널 키.
- `NEXT_PUBLIC_PORTONE_PAY_METHOD`: 기본 결제수단. 미설정 시 `CARD`.
- `PORTONE_API_SECRET`: 서버측 결제 단건 조회에 사용하는 V2 API Secret.
- `PORTONE_API_BASE_URL`: 선택값. 미설정 시 `https://api.portone.io`.
- `NEXT_PUBLIC_SITE_URL`: 모바일 redirect URL의 origin. 미설정 시 요청 origin을 사용한다.

## 다음 구현 단위

- PortOne 웹훅 수신과 중복 이벤트 처리.
- 관리자 주문 목록, 주문 상세, 배송 상태와 송장 입력.
- 선물하기 수령인 배송지 입력 링크와 알림 발송.
- 주문 완료 이메일 발송.
