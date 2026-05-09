# 도자기 공방 홈페이지 DB 마이그레이션 작업서

- 문서 버전: v1.0
- 작성일: 2026-04-24
- 상태: Draft
- 기준 문서
  - `pottery_technical_spec.md`
  - `pottery_execution_plan.md`

## 1. 문서 목적

이 문서는 Supabase Postgres + Drizzle ORM 기준으로 DB를 실제 생성할 때 필요한 작업 순서와 검증 항목을 정리한 문서다.

이 문서의 목표는 다음과 같다.

- 테이블 생성 순서를 명확히 한다
- 각 마이그레이션 파일에 들어가야 할 핵심 요소를 정리한다
- 운영 중 문제가 되기 쉬운 제약조건과 인덱스를 선반영한다
- 예약/결제 정합성을 DB 레벨에서도 보호한다

## 2. DB 설계 원칙

- 공개 콘텐츠는 DB에 넣지 않고 Notion에서 관리한다.
- 예약, 결제, 문의, 구독 등 상태 전이가 발생하는 데이터만 DB에 저장한다.
- 모든 시간은 `timestamptz` 기준으로 저장한다.
- 모든 PK는 `uuid`를 사용한다.
- 소프트 삭제 컬럼은 v1에서 두지 않고 상태 전이로 관리한다.
- 외부 API 원본 payload는 추적 목적으로 `jsonb`에 저장한다.
- 인덱스는 조회 패턴 중심으로 최소하지만 명확하게 둔다.

## 3. 권장 마이그레이션 순서

```text
001_extensions_and_base.sql
002_class_sessions.sql
003_reservations.sql
004_payments.sql
005_inquiries.sql
006_newsletter_subscriptions.sql
007_notification_logs.sql
008_webhook_events.sql
009_indexes_and_constraints_hardening.sql
010_seed_dev_data.sql
```

## 4. 단계별 작업

## 4.1 Migration 001. 확장 및 공통 기반

### 목적

- UUID 생성 및 공통 timestamp 기본값 등 베이스 준비

### 작업

- `pgcrypto` 또는 UUID 생성에 필요한 확장 활성화
- 기본 공통 함수/정책 필요 여부 점검

### 포함 항목

- `gen_random_uuid()` 사용 가능 상태 확인

### 검증

- UUID 생성 테스트 쿼리 실행

## 4.2 Migration 002. `class_sessions`

### 목적

- 실제 예약 가능한 회차 데이터 저장

### 컬럼

- `id`
- `class_slug`
- `start_at`
- `end_at`
- `capacity`
- `seats_held`
- `seats_confirmed`
- `status`
- `naver_reservation_url`
- `created_at`
- `updated_at`

### 제약조건

- `capacity > 0`
- `seats_held >= 0`
- `seats_confirmed >= 0`
- `seats_held + seats_confirmed <= capacity`
- `unique(class_slug, start_at)`

### 인덱스

- `(class_slug, start_at)`
- `(status, start_at)`

### 검증

- 정상 row insert
- capacity보다 큰 held+confirmed insert 차단 확인

## 4.3 Migration 003. `reservations`

### 목적

- 예약 초안부터 취소/환불까지 상태 관리

### 컬럼

- `id`
- `reservation_no`
- `session_id`
- `class_slug`
- `customer_name`
- `customer_phone`
- `customer_email`
- `party_size`
- `amount_total`
- `status`
- `hold_expires_at`
- `request_note`
- `source`
- `created_at`
- `updated_at`

### FK

- `session_id -> class_sessions.id`

### 제약조건

- `party_size > 0`
- `amount_total >= 0`
- `reservation_no unique`

### 인덱스

- `(session_id, status)`
- `(customer_email, created_at desc)`
- `(status, hold_expires_at)`

### 검증

- session 없는 reservation insert 실패 확인
- 음수 금액/인원 차단 확인

## 4.4 Migration 004. `payments`

### 목적

- Toss 결제 결과 및 승인 정보 저장

### 컬럼

- `id`
- `reservation_id`
- `provider`
- `provider_order_id`
- `provider_payment_key`
- `amount`
- `status`
- `approved_at`
- `raw_payload`
- `created_at`
- `updated_at`

### FK

- `reservation_id -> reservations.id`

### 제약조건

- `provider_order_id unique`
- `provider_payment_key unique`
- `amount >= 0`

주의:

- `provider_payment_key`는 결제 전 단계에서는 없을 수 있으므로 nullable 허용

### 인덱스

- `(reservation_id)`
- `(status, created_at desc)`

### 검증

- 동일 결제키 중복 입력 차단
- 미결제 상태에서도 row 생성 가능한지 확인

## 4.5 Migration 005. 문의 테이블

### 대상 테이블

- `premium_inquiries`
- `custom_order_inquiries`

### 목적

- 프리미엄 작업물 문의와 주문제작 문의 저장

### 주요 컬럼

#### `premium_inquiries`

- `id`
- `product_slug`
- `customer_name`
- `customer_phone`
- `customer_email`
- `message`
- `status`
- `created_at`

#### `custom_order_inquiries`

- `id`
- `customer_name`
- `customer_phone`
- `customer_email`
- `purpose`
- `quantity`
- `budget_min`
- `budget_max`
- `due_date`
- `reference_image_urls`
- `message`
- `status`
- `created_at`

### 검증

- JSONB 배열 저장 확인
- budget 범위 저장 확인

## 4.6 Migration 006. `newsletter_subscriptions`

### 목적

- 이메일 구독 관리

### 컬럼

- `id`
- `email`
- `status`
- `source`
- `created_at`
- `updated_at`

### 제약조건

- `email unique`

### 인덱스

- 필요 시 `status`

### 검증

- 같은 이메일 중복 insert 방지

## 4.7 Migration 007. `notification_logs`

### 목적

- 메일/카카오 발송 결과 저장

### 컬럼

- `id`
- `event_type`
- `channel`
- `target`
- `provider`
- `status`
- `payload`
- `response`
- `created_at`

### 인덱스

- `(event_type, created_at desc)`
- `(channel, status, created_at desc)`

### 검증

- `email`, `kakao` 모두 저장 가능 확인

## 4.8 Migration 008. `webhook_events`

### 목적

- Toss 웹훅 중복 처리 방지 및 원본 저장

### 컬럼

- `id`
- `provider`
- `event_type`
- `event_key`
- `payload`
- `processed_at`
- `created_at`

### 제약조건

- `event_key unique`

### 인덱스

- `(provider, created_at desc)`
- `(processed_at)`

### 검증

- 동일 `event_key` 중복 차단 확인

## 4.9 Migration 009. 인덱스/제약 강화

### 목적

- 실제 쿼리 패턴 반영
- 오픈 전 점검 중 추가 발견된 인덱스 보강

### 후보 작업

- reservation 상태 필터 인덱스 점검
- session 날짜 범위 조회 인덱스 점검
- 로그 테이블 보존 정책 점검

### 검증

- 주요 조회 쿼리에 대해 explain 점검

## 4.10 Migration 010. 개발용 seed 데이터

### 목적

- 예약/결제 시나리오 테스트

### seed 대상

- `class_sessions`
- 샘플 `reservations`
- 샘플 `payments`

주의:

- production에는 적용하지 않는다.

## 5. Drizzle 구현 체크리스트

### 필수 스키마 파일

- `db/schema/class-sessions.ts`
- `db/schema/reservations.ts`
- `db/schema/payments.ts`
- `db/schema/inquiries.ts`
- `db/schema/newsletter-subscriptions.ts`
- `db/schema/notification-logs.ts`
- `db/schema/webhook-events.ts`
- `db/schema/index.ts`

### 필수 구현 항목

- enum 대체용 text union 또는 pg enum 결정
- `created_at`, `updated_at` 공통 헬퍼 여부 결정
- `updated_at` 자동 갱신 전략 결정

권장:

- 상태값은 초기에 `text + 앱 레벨 union`으로 시작
- 상태값이 안정되면 pg enum 전환 검토

## 6. 쿼리/트랜잭션 구현 우선순위

## 6.1 우선 구현 쿼리

- 특정 클래스의 오픈 세션 목록 조회
- 특정 세션 잔여석 계산 조회
- 고객 이메일 기준 최근 예약 조회
- 상태별 예약 목록 조회

## 6.2 우선 구현 트랜잭션

- 예약 초안 생성
- 결제 성공 시 상태 전이
- 홀드 만료 처리
- 환불/취소 시 좌석 복구

## 7. 테스트 시나리오

### 예약 정합성

- 같은 회차에 동시 요청 2건 발생
- 남은 좌석보다 큰 인원 예약 시도
- 홀드 만료 후 좌석 자동 복구

### 결제 정합성

- 결제 성공 후 상태 전이
- 결제 실패 후 좌석 복구
- 성공 페이지 재호출 시 멱등 처리
- 웹훅 중복 수신 시 멱등 처리

### 문의/구독

- 주문제작 첨부 URL 저장
- 동일 구독 이메일 중복 요청

## 8. 운영 주의사항

- `class_slug`는 Notion의 slug와 일치해야 한다.
- 운영 중 slug 변경 시 기존 예약 데이터와 연결 설명이 어려워질 수 있다.
- 결제 금액은 프론트 기준이 아니라 서버 계산값을 최종 기준으로 삼는다.
- 로그성 테이블은 장기적으로 보존 기간 정책이 필요하다.

## 9. 마이그레이션 완료 기준

- 모든 migration이 순서대로 적용된다.
- 롤백 전략을 최소 1회 검토했다.
- 예약/결제/문의 주요 CRUD 테스트를 통과했다.
- 핵심 인덱스가 적용된 상태에서 기본 조회 속도에 문제가 없다.

