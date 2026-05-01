# 도자기 공방 홈페이지 개발 기술명세서

- 문서 버전: v1.0
- 작성일: 2026-04-24
- 상태: Draft
- 기준 문서: `pottery_prd.md`

## 1. 문서 목적

이 문서는 도자기 공방 홈페이지의 실제 개발 착수를 위한 기술 기준 문서다.
제품 범위, 시스템 구조, 데이터 모델, 외부 연동, 운영 방식, 보안 및 배포 기준을 정의한다.

이 문서는 다음 질문에 답할 수 있어야 한다.

- 어떤 기술로 구현하는가
- 어떤 데이터는 Notion에 두고 어떤 데이터는 DB에 두는가
- 예약, 결제, 문의, 알림은 어떤 흐름으로 처리하는가
- 어떤 페이지를 어떤 렌더링 전략으로 제공하는가
- 4주 내 출시를 위해 무엇을 v1에 포함하고 무엇을 제외하는가

## 2. 제품 범위

### 2.1 v1 포함 범위

- 공개 페이지
  - 홈 `/`
  - 소개 `/intro`
  - 소식 목록 `/news`
  - 소식 상세 `/news/[slug]`
  - 참여 `/class`
  - 클래스 상세 `/class/[slug]`
  - 소장 `/shop`
  - 작품 상세 `/shop/[slug]`
- 공통 기능
  - 반응형 글로벌 네비게이션
  - SEO 메타데이터
  - OG 이미지
  - 카카오채널 CTA
  - 카카오맵 위치 표시
- CMS
  - Notion 기반 콘텐츠 관리
  - 소식, 작품, 클래스 소개 콘텐츠 노출
- 전환 기능
  - 자체 예약 폼
  - 토스페이먼츠 결제위젯 기반 결제
  - 스마트스토어 우선 외부 구매 링크
  - 프리미엄 작품 문의
  - 주문제작 문의
  - 이메일 구독
- 운영 기능
  - Resend 메일 발송
  - 예약/문의/결제 데이터 DB 저장
  - 분석 이벤트 수집

### 2.2 v1 제외 범위

- 별도 관리자 페이지
- 회원가입 및 로그인
- 자체 재고관리형 쇼핑몰
- 네이버 예약과 내부 예약 좌석 자동 동기화
- 카카오 알림톡 공급사 확정 전 실제 알림톡 발송
- Sanity CMS 전환

## 3. 핵심 의사결정

| 주제 | 결정 |
|---|---|
| 프레임워크 | Next.js App Router 최신 안정 패치 |
| 배포 | Vercel |
| 스타일링 | Tailwind CSS v4 |
| 콘텐츠 CMS | Notion 고정 |
| 트랜잭션 DB | Supabase Postgres |
| 파일 저장소 | Supabase Storage |
| 결제 | Toss Payments 결제위젯 v2 |
| 지도 | Kakao Map |
| 기본 구매 링크 | 스마트스토어 우선 |
| 예약 메인 채널 | 홈페이지 자체 예약/결제 |
| 네이버 예약 | 보조 유입 링크 |
| 운영 방식 | Notion + 알림 메일 + DB 관리 |
| 카카오 알림톡 | 공급사 미정, 인터페이스만 선구현 |

## 4. 기술 스택

| 영역 | 기술 | 선택 이유 |
|---|---|---|
| 앱 프레임워크 | Next.js App Router | SSG, ISR, SSR, Route Handler, Server Action을 한 프로젝트에서 일관되게 사용 가능 |
| 런타임 | Node.js 20.9+ | 최신 Next.js 안정 지원 |
| UI | React 19.2.4+ | 최신 Next.js 요구사항 및 보안 패치 대응 |
| 스타일 | Tailwind CSS v4 | 빠른 제작, 토큰 기반 스타일링 |
| 컴포넌트 | shadcn/ui | 폼, 다이얼로그, 시트, 카드 등 재사용성 확보 |
| 콘텐츠 | Notion API | 비개발자 콘텐츠 운영 |
| 관계형 DB | Supabase Postgres | 예약/결제/문의의 트랜잭션 처리 |
| ORM/마이그레이션 | Drizzle ORM | 타입 안정성, SQL 친화성, 마이그레이션 관리 |
| 파일 스토리지 | Supabase Storage | 주문제작 참고 이미지 업로드 |
| 결제 | Toss Payments 결제위젯 v2 | 웹 결제 UX와 국내 결제수단 대응 |
| 이메일 | Resend | 문의 및 예약 메일 발송 |
| 지도 | Kakao Map JavaScript SDK | 국내 사용성 및 길찾기 친화성 |
| 분석 | GA4, Vercel Analytics, Microsoft Clarity | 전환, 유입, 행동 분석 |
| 배포/운영 | Vercel + Supabase | 역할 분리와 관리 단순성 |

## 5. 상위 아키텍처

```text
[브라우저]
   |
   v
[Next.js App Router on Vercel]
   |-- Server Components / Server Actions / Route Handlers
   |
   |-- read --> [Notion API]
   |-- read/write --> [Supabase Postgres]
   |-- upload --> [Supabase Storage]
   |-- payment --> [Toss Payments]
   |-- email --> [Resend]
   |-- map sdk --> [Kakao Map]
   |-- analytics --> [GA4 / Vercel Analytics / Clarity]
   |
   `-- notify --> [Kakao 알림 인터페이스]
                     |
                     `-- 공급사 확정 후 연결
```

### 5.1 데이터 역할 분리

- Notion
  - 사람이 직접 수정하는 공개 콘텐츠
  - 소식, 작품, 클래스 소개, 후기 승인 결과, 사이트 설정
- Postgres
  - 실시간성과 정합성이 중요한 데이터
  - 예약, 결제, 문의, 구독, 알림 로그, 웹훅 로그
- Storage
  - 주문제작 참고 이미지 파일

### 5.2 설계 원칙

- 공개 콘텐츠와 트랜잭션 데이터를 분리한다.
- 사용자 입력이 결제/좌석/상태 변경을 일으키는 경우 DB를 기준으로 처리한다.
- 외부 SDK 및 API 클라이언트는 모두 lazy initialization 패턴으로 초기화한다.
- 서버에서만 DB와 외부 비밀키에 접근한다.
- 카카오 알림은 공급사 미정 상태를 고려해 어댑터 인터페이스로 추상화한다.

## 6. 렌더링 및 캐싱 전략

| 페이지 | 경로 | 전략 | 이유 |
|---|---|---|---|
| 홈 | `/` | SSG + ISR | 브랜드 랜딩, 잦지 않은 변경 |
| 소개 | `/intro` | SSG | 고정 정보 중심 |
| 소식 목록 | `/news` | SSG + ISR 600초 | Notion 콘텐츠 반영 |
| 소식 상세 | `/news/[slug]` | SSG + ISR 600초 | 검색 유입 및 SEO |
| 참여 | `/class` | SSR | 실시간 잔여석 반영 |
| 클래스 상세 | `/class/[slug]` | SSR | 일정/가격/좌석 최신성 필요 |
| 소장 목록 | `/shop` | SSG + ISR 600초 | 상품 콘텐츠 위주 |
| 작품 상세 | `/shop/[slug]` | SSG + ISR 600초 | 외부 구매/문의 유도 |

### 6.1 캐싱 규칙

- Notion 기반 목록/상세 데이터는 `revalidate = 600`을 기본값으로 사용한다.
- 예약 가능 좌석은 SSR에서 DB 직접 조회로 제공한다.
- 결제, 예약 생성, 문의 제출은 캐시하지 않는다.
- 이미지 및 정적 자산은 Vercel CDN 기본 캐싱을 따른다.
- 인스타그램 피드는 공급사/방식 확정 후 별도 캐싱 정책을 둔다.

## 7. 정보 구조와 라우팅

### 7.1 공개 라우트

```text
/
/intro
/news
/news/[slug]
/class
/class/[slug]
/shop
/shop/[slug]
/success
/fail
/privacy
/terms
```

### 7.2 서버 라우트

```text
/api/uploads/sign
/api/toss/confirm
/api/webhooks/toss
/api/instagram
/api/revalidate/notion
```

### 7.3 프로젝트 디렉터리 제안

```text
src/
  app/
    (site)/
      layout.tsx
      page.tsx
      intro/page.tsx
      news/page.tsx
      news/[slug]/page.tsx
      class/page.tsx
      class/[slug]/page.tsx
      shop/page.tsx
      shop/[slug]/page.tsx
      success/page.tsx
      fail/page.tsx
      privacy/page.tsx
      terms/page.tsx
    api/
      uploads/sign/route.ts
      toss/confirm/route.ts
      webhooks/toss/route.ts
      instagram/route.ts
      revalidate/notion/route.ts
    actions/
      reservation.ts
      custom-order.ts
      subscribe.ts
  components/
    layout/
    home/
    intro/
    news/
    class/
    shop/
    forms/
    ui/
  lib/
    config/
    notion/
    db/
    payments/
    notifications/
    analytics/
    validators/
    utils/
  db/
    schema/
    migrations/
  types/
  styles/
```

## 8. 콘텐츠 모델 설계

## 8.1 Notion 데이터소스

### A. `Posts`

| 필드 | 타입 | 설명 |
|---|---|---|
| `title` | title | 글 제목 |
| `slug` | rich_text | URL slug |
| `excerpt` | rich_text | 목록 요약 |
| `cover_image` | files/url | 대표 이미지 |
| `tags` | multi_select | 작업일지, 일정, 비하인드, 신제품 |
| `published_at` | date | 게시일 |
| `status` | select | draft, published |
| `seo_title` | rich_text | SEO 제목 |
| `seo_description` | rich_text | SEO 설명 |

### B. `Classes`

| 필드 | 타입 | 설명 |
|---|---|---|
| `title` | title | 클래스명 |
| `slug` | rich_text | URL slug |
| `type` | select | oneday, regular, group |
| `summary` | rich_text | 요약 |
| `description` | rich_text / page content | 상세 설명 |
| `duration_minutes` | number | 소요시간 |
| `base_price` | number | 기준가 |
| `capacity_default` | number | 기본 정원 |
| `thumbnail` | files/url | 대표 이미지 |
| `naver_reservation_url` | url | 보조 예약 링크 |
| `status` | select | draft, published |

### C. `Products`

| 필드 | 타입 | 설명 |
|---|---|---|
| `title` | title | 작품명 |
| `slug` | rich_text | URL slug |
| `category` | select | basic, mid, premium, set, custom |
| `price_label` | rich_text | 가격표시 |
| `summary` | rich_text | 요약 |
| `description` | rich_text / page content | 상세 설명 |
| `inventory_status` | select | on_sale, limited, sold_out |
| `purchase_url` | url | 스마트스토어 링크 |
| `is_premium` | checkbox | 프리미엄 여부 |
| `is_custom` | checkbox | 주문제작 여부 |
| `thumbnail` | files/url | 대표 이미지 |
| `status` | select | draft, published |

### D. `Reviews`

| 필드 | 타입 | 설명 |
|---|---|---|
| `author_alias` | title | 노출 이름 |
| `target_type` | select | class, product |
| `target_slug` | rich_text | 연결 대상 slug |
| `rating` | number | 평점 |
| `body` | rich_text | 후기 본문 |
| `approved` | checkbox | 노출 승인 여부 |
| `created_at` | date | 작성일 |

### E. `SiteSettings`

| 필드 | 타입 | 설명 |
|---|---|---|
| `site_name` | title | 사이트명 |
| `brand_slogan` | rich_text | 메인 슬로건 |
| `address` | rich_text | 공방 주소 |
| `parking_info` | rich_text | 주차 안내 |
| `business_hours` | rich_text | 운영 시간 |
| `kakao_channel_url` | url | 카카오채널 링크 |
| `instagram_url` | url | 인스타그램 링크 |
| `smartstore_url` | url | 대표 스토어 링크 |
| `seo_default_title` | rich_text | 기본 SEO 제목 |
| `seo_default_description` | rich_text | 기본 SEO 설명 |

## 8.2 콘텐츠와 트랜잭션 데이터의 연결 방식

- 공개 콘텐츠는 Notion의 `slug`를 기준으로 라우팅한다.
- 트랜잭션 테이블은 Notion row id 대신 `class_slug`, `product_slug`를 보조 키로 저장한다.
- Notion row id가 바뀌지 않더라도 운영자가 slug를 변경하면 링크가 깨질 수 있으므로 slug 변경은 배포 후 제한한다.
- `slug` 변경이 필요한 경우 리디렉션 정책을 별도로 관리한다.

## 9. 트랜잭션 DB 설계

## 9.1 테이블 목록

| 테이블 | 목적 |
|---|---|
| `class_sessions` | 실제 예약 가능한 회차 |
| `reservations` | 예약 신청 및 상태 |
| `payments` | 결제 상태 및 PG 응답 저장 |
| `premium_inquiries` | 프리미엄 작품 문의 |
| `custom_order_inquiries` | 주문제작 문의 |
| `newsletter_subscriptions` | 뉴스레터 구독 |
| `notification_logs` | 메일/카카오 발송 이력 |
| `webhook_events` | Toss 웹훅 원본 저장 |

## 9.2 핵심 테이블 정의

### `class_sessions`

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid pk | 내부 식별자 |
| `class_slug` | text | Notion `Classes.slug` 참조 |
| `start_at` | timestamptz | 시작 시각 |
| `end_at` | timestamptz | 종료 시각 |
| `capacity` | integer | 총 정원 |
| `seats_held` | integer | 결제 대기 홀드 좌석 |
| `seats_confirmed` | integer | 결제 완료 좌석 |
| `status` | text | draft, open, closed, canceled |
| `naver_reservation_url` | text nullable | 보조 예약 링크 |
| `created_at` | timestamptz | 생성일 |
| `updated_at` | timestamptz | 수정일 |

제약 조건:

- `capacity > 0`
- `seats_held >= 0`
- `seats_confirmed >= 0`
- `seats_held + seats_confirmed <= capacity`
- `unique(class_slug, start_at)`

인덱스:

- `index(class_slug, start_at)`
- `index(status, start_at)`

### `reservations`

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid pk | 내부 식별자 |
| `reservation_no` | text unique | 사용자/운영자용 예약번호 |
| `session_id` | uuid fk | `class_sessions.id` |
| `class_slug` | text | 검색용 보조 키 |
| `customer_name` | text | 예약자명 |
| `customer_phone` | text | 휴대전화 |
| `customer_email` | text | 이메일 |
| `party_size` | integer | 예약 인원 |
| `amount_total` | integer | 총 결제 금액 |
| `status` | text | draft, payment_pending, paid, confirmed, expired, canceled, refunded |
| `hold_expires_at` | timestamptz nullable | 홀드 만료 시각 |
| `request_note` | text nullable | 요청사항 |
| `source` | text | homepage, naver_link |
| `created_at` | timestamptz | 생성일 |
| `updated_at` | timestamptz | 수정일 |

제약 조건:

- `party_size > 0`
- `amount_total >= 0`

인덱스:

- `index(session_id, status)`
- `index(customer_email, created_at desc)`
- `index(status, hold_expires_at)`

### `payments`

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid pk | 내부 식별자 |
| `reservation_id` | uuid fk | `reservations.id` |
| `provider` | text | `toss` |
| `provider_order_id` | text unique | Toss 주문번호 |
| `provider_payment_key` | text unique nullable | Toss 결제키 |
| `amount` | integer | 결제 금액 |
| `status` | text | ready, confirmed, canceled, failed |
| `approved_at` | timestamptz nullable | 결제 승인 시각 |
| `raw_payload` | jsonb | 원본 응답 |
| `created_at` | timestamptz | 생성일 |
| `updated_at` | timestamptz | 수정일 |

인덱스:

- `index(reservation_id)`
- `index(status, created_at desc)`

### `premium_inquiries`

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid pk | 내부 식별자 |
| `product_slug` | text | 문의 대상 작품 |
| `customer_name` | text | 문의자명 |
| `customer_phone` | text | 연락처 |
| `customer_email` | text | 이메일 |
| `message` | text | 문의 내용 |
| `status` | text | received, reviewed, closed |
| `created_at` | timestamptz | 생성일 |

### `custom_order_inquiries`

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid pk | 내부 식별자 |
| `customer_name` | text | 문의자명 |
| `customer_phone` | text | 연락처 |
| `customer_email` | text | 이메일 |
| `purpose` | text | 용도 |
| `quantity` | integer nullable | 수량 |
| `budget_min` | integer nullable | 최소 예산 |
| `budget_max` | integer nullable | 최대 예산 |
| `due_date` | date nullable | 희망 일정 |
| `reference_image_urls` | jsonb | 업로드 이미지 URL 배열 |
| `message` | text | 요구사항 |
| `status` | text | received, reviewed, quoted, closed |
| `created_at` | timestamptz | 생성일 |

### `newsletter_subscriptions`

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid pk | 내부 식별자 |
| `email` | text unique | 구독 이메일 |
| `status` | text | subscribed, unsubscribed |
| `source` | text | news_page, footer, popup |
| `created_at` | timestamptz | 생성일 |
| `updated_at` | timestamptz | 수정일 |

### `notification_logs`

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid pk | 내부 식별자 |
| `event_type` | text | reservation_confirmed, custom_order_received 등 |
| `channel` | text | email, kakao |
| `target` | text | 이메일 또는 전화번호 |
| `provider` | text nullable | resend, kakao_provider_name |
| `status` | text | pending, sent, failed, skipped |
| `payload` | jsonb | 발송 페이로드 |
| `response` | jsonb nullable | 응답 원문 |
| `created_at` | timestamptz | 생성일 |

### `webhook_events`

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | uuid pk | 내부 식별자 |
| `provider` | text | `toss` |
| `event_type` | text | 웹훅 타입 |
| `event_key` | text unique | 중복 수신 방지 키 |
| `payload` | jsonb | 원본 바디 |
| `processed_at` | timestamptz nullable | 처리 완료 시각 |
| `created_at` | timestamptz | 생성일 |

## 9.3 DB 운영 원칙

- 브라우저에서 DB에 직접 접근하지 않는다.
- 모든 DB write는 Server Action 또는 Route Handler를 통해서만 수행한다.
- 좌석 수량은 트랜잭션과 row-level lock으로 보호한다.
- 예약 데이터는 soft-delete하지 않고 상태 전이로 관리한다.
- 외부 API 원본 응답과 웹훅 payload는 추적을 위해 JSONB로 보관한다.

## 10. 예약 및 결제 플로우

## 10.1 예약 생성 플로우

1. 사용자가 클래스 상세 페이지에서 회차와 인원을 선택한다.
2. 서버는 `class_sessions` 행을 lock하고 잔여 좌석을 확인한다.
3. 좌석이 충분하면 `reservations.status = draft`로 예약 초안을 생성한다.
4. 동시에 `class_sessions.seats_held`를 증가시킨다.
5. `hold_expires_at`을 현재 시각 기준 15분 뒤로 설정한다.
6. 프론트는 Toss 결제위젯을 호출할 주문 데이터를 생성한다.

## 10.2 결제 성공 플로우

1. Toss 승인 완료 후 `/api/toss/confirm`에서 서버 검증을 수행한다.
2. 검증 성공 시 `payments.status = confirmed`로 저장한다.
3. `reservations.status`를 `paid` 또는 `confirmed`로 전이한다.
4. `class_sessions.seats_held`를 감소시키고 `seats_confirmed`를 증가시킨다.
5. 예약 확인 메일을 발송한다.
6. 카카오 알림 인터페이스가 설정되어 있으면 알림 발송을 시도한다.
7. 결과는 `notification_logs`에 저장한다.

## 10.3 결제 실패/만료 플로우

1. 결제 실패 시 `reservations.status = canceled` 또는 `expired`로 전이한다.
2. `class_sessions.seats_held`를 감소시켜 좌석을 반환한다.
3. `hold_expires_at` 경과 건은 Vercel Cron 또는 주기 작업으로 정리한다.

## 10.4 네이버 예약 병행 원칙

- 네이버 예약은 보조 유입 채널이다.
- 내부 좌석과 외부 좌석을 자동 동기화하지 않는다.
- 같은 회차를 양쪽 채널에서 동시에 판매하려면 운영자가 별도 정원 분리 정책을 가져야 한다.
- v1에서 홈페이지 메인 CTA는 자체 예약/결제다.

## 11. 폼과 서버 액션/Route Handler 설계

## 11.1 Server Actions

| 액션 | 목적 |
|---|---|
| `createReservationDraft` | 예약 초안 생성 및 좌석 홀드 |
| `submitPremiumInquiry` | 프리미엄 작품 문의 접수 |
| `submitCustomOrderInquiry` | 주문제작 문의 접수 |
| `subscribeNewsletter` | 이메일 구독 처리 |

## 11.2 Route Handlers

| 경로 | 목적 |
|---|---|
| `POST /api/toss/confirm` | 결제 승인 검증 및 DB 반영 |
| `POST /api/webhooks/toss` | Toss 웹훅 처리 |
| `POST /api/uploads/sign` | Storage 업로드용 signed URL 발급 |
| `GET /api/instagram` | 인스타그램 피드 캐싱 반환 |
| `POST /api/revalidate/notion` | 콘텐츠 재검증 트리거 |

## 11.3 검증 정책

- 모든 입력은 Zod 스키마로 서버 검증한다.
- 파일 업로드는 파일 크기, MIME type, 개수를 서버에서 제한한다.
- 전화번호와 이메일은 정규화 후 저장한다.
- 금액, 인원수, 일정은 서버가 최종 계산 및 검증한다.

## 12. 외부 연동 설계

## 12.1 Notion API

- 읽기 전용으로 사용한다.
- 운영자는 Notion에서 콘텐츠를 작성/수정한다.
- `draft` 상태는 사이트에 노출하지 않는다.
- 콘텐츠 반영은 ISR 10분을 기본으로 하며 필요 시 수동 재검증 엔드포인트를 사용한다.

## 12.2 Toss Payments

- 결제위젯 v2를 사용한다.
- 서버는 승인 검증과 주문 금액 검증의 최종 책임을 가진다.
- `provider_order_id`는 내부 `reservation_no`와 연결 가능한 형태로 생성한다.
- 웹훅은 보조 수단으로 저장하되, 사용자가 리다이렉트된 성공 페이지 처리와 중복되어도 멱등하게 작동해야 한다.

## 12.3 Kakao Map

- 소개 페이지에 공방 위치와 오시는 길을 제공한다.
- Kakao JavaScript key와 등록 도메인이 필요하다.
- 길찾기 링크는 카카오맵 외부 이동으로 제공한다.

## 12.4 Kakao 알림

- 공급사는 아직 미정이다.
- 따라서 알림 시스템은 아래 인터페이스를 기준으로 구현한다.

```ts
type NotificationChannel = "email" | "kakao"

interface NotificationAdapter {
  sendReservationConfirmed(input: unknown): Promise<void>
  sendCustomOrderReceived(input: unknown): Promise<void>
}
```

- v1 기본 동작
  - 이메일은 실제 발송
  - 카카오는 공급사 미연결 시 `skipped` 로그 저장
- 공급사 확정 후 해야 할 일
  - 템플릿 승인 절차 반영
  - 발송 API 인증키 연결
  - 실패 재시도 정책 추가

## 12.5 Instagram 피드

- PRD에는 자동 피드 연동 요구가 있다.
- 다만 Meta 정책 변화가 잦기 때문에 실제 구현 시작 시점의 공식 제공 방식을 재확인한다.
- 구현 원칙은 다음과 같다.
  - 서버에서만 액세스 토큰 또는 외부 공급사 키를 사용한다.
  - 클라이언트에는 캐시된 결과만 전달한다.
  - 공급 방식 확정 전에는 컴포넌트와 API 인터페이스만 먼저 준비한다.

## 12.6 Resend

- 예약 확인 메일
- 주문제작 문의 접수 메일
- 프리미엄 작품 문의 접수 메일
- 뉴스레터 구독 확인 메일

메일 발송 실패 시:

- 사용자 저장은 성공 상태를 유지한다.
- `notification_logs`에 실패를 기록한다.
- 운영자 재전송이 가능하도록 원본 데이터를 보관한다.

## 13. 보안 및 권한

### 13.1 기본 원칙

- 모든 비밀키는 Vercel 환경변수로만 관리한다.
- 서비스 롤 키와 DB write 권한은 서버에서만 사용한다.
- 브라우저에는 public key만 노출한다.
- `x-middleware-subrequest` 헤더 우회 이슈를 고려해 권한 검증을 proxy 단독에 의존하지 않는다.

### 13.2 스팸/남용 방지

- 예약, 문의, 구독 폼에 reCAPTCHA v3 또는 Turnstile 적용
- 서버측 IP/UA 기반 rate limit
- 동일 이메일/전화번호의 과도한 반복 요청 차단

### 13.3 개인정보

- 최소한의 개인정보만 수집한다.
- 주민번호, 카드번호 등 민감 결제정보는 저장하지 않는다.
- 결제 관련 정보는 PG 응답 식별자만 저장한다.

## 14. 성능 및 품질 기준

| 항목 | 기준 |
|---|---|
| LCP | 2.5초 이내 |
| CLS | 0.1 이하 목표 |
| 모바일 우선 | 전체 주요 흐름을 모바일에서 먼저 설계 |
| 이미지 | `next/image`, WebP/AVIF 우선 |
| 폰트 | `next/font` 사용 |
| 접근성 | 폼 라벨, 키보드 탐색, 대비, 에러 안내 포함 |

### 14.1 성능 구현 규칙

- 히어로 이미지는 `priority`를 사용한다.
- 동영상은 직접 업로드 대신 외부 임베드를 우선 검토한다.
- Client Component는 최소 범위로 제한한다.
- 데이터 조회는 가능한 한 Server Component에서 처리한다.
- 외부 SDK는 페이지별로 지연 로딩한다.

## 15. SEO 및 분석

### 15.1 SEO

- 페이지별 `generateMetadata` 사용
- 구조화 데이터 적용
  - LocalBusiness
  - Event 또는 Course
  - Article
- `sitemap.xml`, `robots.txt` 제공
- 네이버 서치어드바이저 및 Search Console 등록

### 15.2 분석 이벤트

| 이벤트명 | 설명 |
|---|---|
| `view_class_detail` | 클래스 상세 조회 |
| `start_reservation` | 예약 시작 |
| `complete_payment` | 결제 완료 |
| `click_smartstore` | 스마트스토어 링크 클릭 |
| `submit_premium_inquiry` | 프리미엄 문의 제출 |
| `submit_custom_order` | 주문제작 문의 제출 |
| `subscribe_newsletter` | 구독 완료 |
| `click_kakao_channel` | 카카오채널 클릭 |

## 16. 환경변수

```bash
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_GA_ID=
NEXT_PUBLIC_KAKAO_JS_KEY=
NEXT_PUBLIC_TOSS_CLIENT_KEY=
NEXT_PUBLIC_CLARITY_ID=

NOTION_TOKEN=
NOTION_POSTS_DATABASE_ID=
NOTION_CLASSES_DATABASE_ID=
NOTION_PRODUCTS_DATABASE_ID=
NOTION_REVIEWS_DATABASE_ID=
NOTION_SITE_SETTINGS_DATABASE_ID=

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=

TOSS_SECRET_KEY=
TOSS_WEBHOOK_SECRET=

RESEND_API_KEY=
RESEND_FROM_EMAIL=
ADMIN_NOTIFICATION_EMAIL=

REVALIDATE_SECRET=
UPLOAD_MAX_MB=

KAKAO_NOTIFICATION_PROVIDER=
KAKAO_NOTIFICATION_API_KEY=
KAKAO_NOTIFICATION_SENDER_KEY=
```

주의:

- `KAKAO_NOTIFICATION_*`는 공급사 확정 전까지 비워둘 수 있다.
- SDK/클라이언트 생성은 모듈 스코프가 아니라 getter 함수 내부에서 초기화한다.

## 17. 출시 단계별 구현 계획

### 17.1 1주차

- Next.js 프로젝트 생성
- 공통 레이아웃, 헤더, 푸터, 모바일 메뉴
- 홈, 소개 페이지 구현
- Notion 스키마/DB 스키마 확정

### 17.2 2주차

- Notion 연동
- 소식/소장 페이지 구현
- 스마트스토어 링크, 프리미엄/주문제작 문의 폼 구축

### 17.3 3주차

- 참여 페이지, 일정 캘린더, 예약 홀드 로직
- Toss 결제 연동
- 예약 완료 메일 발송

### 17.4 4주차

- 인스타그램 섹션 연동 방식 확정 및 적용
- 분석, SEO, 정책 페이지
- 모바일 QA, 배포, 운영 문서 정리

## 18. 오픈 이슈

| 이슈 | 상태 | 메모 |
|---|---|---|
| 카카오 알림톡 공급사 선정 | TBD | 어댑터 인터페이스까지만 선구현 |
| 인스타그램 자동 피드 방식 | TBD | 구현 직전 공식 제공 방식 재확인 필요 |
| 네이버 예약 병행 운영 규칙 | 운영 정책 필요 | 회차별 정원 분리 여부 결정 필요 |

## 19. 개발 원칙 요약

- Notion은 공개 콘텐츠의 소스 오브 트루스다.
- 예약/결제/문의는 Supabase Postgres가 소스 오브 트루스다.
- 메인 예약 채널은 홈페이지 자체 예약/결제다.
- 카카오 알림은 공급사 미정 상태를 고려해 확장 가능한 인터페이스로 구현한다.
- 4주 출시를 위해 관리자 페이지와 외부 채널 좌석 자동 동기화는 제외한다.

