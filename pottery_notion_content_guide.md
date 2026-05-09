# 도자기 공방 홈페이지 Notion 콘텐츠 운영 가이드

- 문서 버전: v1.0
- 작성일: 2026-04-24
- 상태: Draft
- 기준 문서
  - `pottery_technical_spec.md`
  - `pottery_execution_plan.md`

## 1. 문서 목적

이 문서는 운영자가 Notion에서 홈페이지 콘텐츠를 입력하고 수정할 때 따라야 할 기준을 정리한 문서다.

이 문서의 목표:

- 어떤 데이터소스를 만들어야 하는지 명확히 한다
- 각 필드에 무엇을 입력해야 하는지 설명한다
- slug, 이미지, 게시 상태 등 실수하기 쉬운 항목을 통일한다
- 게시/수정/비노출 처리 흐름을 단순화한다

## 2. 운영 원칙

- Notion은 공개 콘텐츠 관리 전용이다.
- 예약, 결제, 문의 데이터는 Notion에서 관리하지 않는다.
- 홈페이지에 노출할 콘텐츠만 Notion에 입력한다.
- `status = draft`인 항목은 사이트에 노출되지 않는다.
- URL 주소가 되는 `slug`는 게시 후 가급적 변경하지 않는다.

## 3. 데이터소스 목록

운영용 Notion에는 아래 5개 데이터소스를 만든다.

1. `Posts`
2. `Classes`
3. `Products`
4. `Reviews`
5. `SiteSettings`

## 4. 공통 입력 규칙

## 4.1 slug 규칙

`slug`는 페이지 주소에 사용된다.

예시:

- `oneday-mug-class`
- `spring-collection-bowl`
- `pottery-gift-guide`

규칙:

- 영어 소문자 사용
- 공백 대신 `-` 사용
- 한글, 특수문자, 슬래시 사용 금지
- 너무 짧거나 모호한 이름 피하기
- 게시 후 변경 최소화

잘못된 예:

- `원데이클래스`
- `oneday class`
- `class/1`
- `Spring_Bowl`

## 4.2 상태값 규칙

`status`는 다음 기준으로 사용한다.

- `draft`: 사이트 비노출
- `published`: 사이트 노출

운영 규칙:

- 입력 중이거나 검토 중이면 `draft`
- 공개 준비가 끝난 뒤 `published`

## 4.3 이미지 규칙

- 대표 이미지는 가급적 가로형 고해상도 사용
- 파일명은 의미 있게 작성
- 흔들리거나 너무 어두운 이미지는 피하기
- 동일 항목 내 대표 이미지는 1개를 우선 지정

권장:

- 가로 비율 4:3 또는 16:9
- 긴 변 1600px 이상
- 용량은 너무 크지 않게 최적화

## 4.4 텍스트 규칙

- 모바일에서 읽기 쉽게 짧은 문단 사용
- 첫 문장은 핵심 메시지부터 작성
- 과도한 이모지, 줄바꿈 남용 금지
- 가격/시간/정원은 항상 숫자로 명확히 표기

## 5. 데이터소스별 입력 가이드

## 5.1 `Posts`

### 목적

- 소식, 작업일지, 일정, 비하인드, 신제품 소개

### 필드 설명

| 필드 | 필수 | 설명 |
|---|---|---|
| `title` | 필수 | 글 제목 |
| `slug` | 필수 | URL 주소 |
| `excerpt` | 권장 | 목록에 보일 1~2문장 요약 |
| `cover_image` | 권장 | 대표 이미지 |
| `tags` | 권장 | 분류 태그 |
| `published_at` | 필수 | 게시일 |
| `status` | 필수 | draft / published |
| `seo_title` | 선택 | 검색용 제목 |
| `seo_description` | 선택 | 검색용 설명 |

### 권장 태그

- 작업일지
- 일정
- 비하인드
- 신제품

### 작성 팁

- 제목은 검색어를 고려해서 구체적으로 작성
- excerpt는 목록에서 클릭하고 싶게 짧게 작성
- 일정성 글은 날짜/장소/신청 방법을 본문 상단에 넣기

### 예시

- 제목: `도자기 원데이 클래스 5월 일정 안내`
- slug: `may-oneday-class-schedule`
- excerpt: `5월 원데이 클래스 오픈 일정을 안내드립니다. 머그컵, 플레이트, 소품 클래스로 구성됩니다.`

## 5.2 `Classes`

### 목적

- 참여 페이지와 클래스 상세 페이지 구성

### 필드 설명

| 필드 | 필수 | 설명 |
|---|---|---|
| `title` | 필수 | 클래스명 |
| `slug` | 필수 | URL 주소 |
| `type` | 필수 | oneday / regular / group |
| `summary` | 필수 | 카드용 한 줄 설명 |
| `description` | 필수 | 상세 설명 |
| `duration_minutes` | 필수 | 소요시간(분) |
| `base_price` | 필수 | 기준가 |
| `capacity_default` | 필수 | 기본 정원 |
| `thumbnail` | 권장 | 대표 이미지 |
| `naver_reservation_url` | 선택 | 보조 예약 링크 |
| `status` | 필수 | draft / published |

### `type` 입력값 규칙

- `oneday`
- `regular`
- `group`

### 작성 팁

- summary에는 클래스의 매력을 짧게 설명
- description에는 아래 내용을 포함
  - 어떤 결과물을 만드는지
  - 초보 가능 여부
  - 소요 시간
  - 준비물 여부
  - 예약 시 유의사항

### 예시

- title: `머그컵 원데이 클래스`
- slug: `mug-oneday-class`
- type: `oneday`
- summary: `처음 오는 분도 부담 없이 참여할 수 있는 1회 체험 클래스`

## 5.3 `Products`

### 목적

- 소장 페이지와 작업물 상세 페이지 구성

### 필드 설명

| 필드 | 필수 | 설명 |
|---|---|---|
| `title` | 필수 | 작업물명 |
| `slug` | 필수 | URL 주소 |
| `category` | 필수 | basic / mid / premium / set / custom |
| `price_label` | 필수 | 가격 또는 가격대 표시 |
| `summary` | 필수 | 카드 요약 |
| `description` | 필수 | 상세 설명 |
| `inventory_status` | 필수 | on_sale / limited / sold_out |
| `purchase_url` | 선택 | 스마트스토어 링크 |
| `is_premium` | 권장 | 프리미엄 여부 |
| `is_custom` | 권장 | 주문제작 여부 |
| `thumbnail` | 권장 | 대표 이미지 |
| `status` | 필수 | draft / published |

### `category` 입력값 규칙

- `basic`
- `mid`
- `premium`
- `set`
- `custom`

### `inventory_status` 입력값 규칙

- `on_sale`
- `limited`
- `sold_out`

### 작성 팁

- `basic`, `mid`는 구매 링크를 넣는다
- `premium`은 문의 유도 문구를 description에 넣는다
- `custom`은 주문제작 가능 범위를 설명한다

### 예시

- title: `청자 유약 머그컵`
- slug: `celadon-mug`
- category: `mid`
- price_label: `58,000원`
- inventory_status: `on_sale`

## 5.4 `Reviews`

### 목적

- 클래스/작업물 후기를 선별 노출

### 필드 설명

| 필드 | 필수 | 설명 |
|---|---|---|
| `author_alias` | 필수 | 노출명 |
| `target_type` | 필수 | class / product |
| `target_slug` | 필수 | 연결 대상 slug |
| `rating` | 선택 | 평점 |
| `body` | 필수 | 후기 본문 |
| `approved` | 필수 | 승인 여부 |
| `created_at` | 권장 | 작성일 |

### 운영 규칙

- 승인된 후기만 노출
- 실명 전체 공개가 부담되면 이니셜 또는 별칭 사용

## 5.5 `SiteSettings`

### 목적

- 사이트 전역 공통 정보 관리

### 필드 설명

| 필드 | 필수 | 설명 |
|---|---|---|
| `site_name` | 필수 | 사이트명 |
| `brand_slogan` | 필수 | 대표 슬로건 |
| `address` | 필수 | 공방 주소 |
| `parking_info` | 권장 | 주차 정보 |
| `business_hours` | 필수 | 운영 시간 |
| `kakao_channel_url` | 필수 | 카카오채널 링크 |
| `instagram_url` | 권장 | 인스타그램 링크 |
| `smartstore_url` | 권장 | 대표 스토어 링크 |
| `seo_default_title` | 권장 | 기본 SEO 제목 |
| `seo_default_description` | 권장 | 기본 SEO 설명 |

### 운영 규칙

- 이 데이터소스는 실질적으로 단일 행만 사용
- 공방 주소, 운영시간 변경 시 가장 먼저 수정

## 6. 콘텐츠 작성 흐름

## 6.1 새 글 작성

1. 해당 데이터소스에서 새 row 생성
2. 제목과 slug 먼저 작성
3. 대표 이미지와 요약 입력
4. 본문 작성
5. 상태를 `draft`로 저장
6. 검토 후 `published`로 변경

## 6.2 수정

1. 기존 row 수정
2. slug는 가급적 유지
3. 대표 이미지 변경 시 목록 카드 영향도 확인
4. 게시 중인 콘텐츠 수정 후 사이트 반영 확인

## 6.3 비노출

콘텐츠를 내리고 싶으면 삭제보다 `status = draft`로 바꾸는 것을 권장한다.

이유:

- 사이트에서 숨기기 쉽다
- URL 및 이력 추적이 가능하다
- 향후 재게시가 쉽다

## 7. 운영자가 자주 실수하는 항목

### slug에 한글/공백 넣기

- 주소가 깨지거나 라우팅이 꼬일 수 있다

### 상태값 입력 실수

- 오타가 있으면 노출 필터에 걸리지 않을 수 있다
- 가능한 select 속성으로만 관리한다

### 대표 이미지 누락

- 목록 카드나 OG 미리보기가 약해진다

### 가격을 본문에만 쓰고 필드에는 비워두기

- 목록 카드와 필터링 UI에 반영되지 않을 수 있다

### 게시 후 slug 변경

- 기존 링크와 SEO가 깨질 수 있다

## 8. 추천 운영 체크리스트

콘텐츠 게시 전:

- 제목이 명확한가
- slug가 규칙에 맞는가
- 대표 이미지가 들어갔는가
- 요약이 작성되었는가
- 상태가 `published`로 되어 있는가

콘텐츠 수정 후:

- 사이트 반영이 되었는가
- 카드/상세 모두 이상 없는가
- 링크가 깨지지 않았는가

## 9. FAQ

### Q. Notion에서 row를 삭제해도 되나요?

가능하지만 권장하지 않는다. 우선 `draft`로 바꾸는 편이 안전하다.

### Q. 이미지가 여러 장이면 어떻게 하나요?

대표 이미지는 필드에 넣고, 나머지는 본문에 넣는 방식을 우선 권장한다.

### Q. 글을 예약 게시할 수 있나요?

v1에서는 별도 예약 게시 기능이 없다. 운영 시점에 `published`로 변경한다.

### Q. 스마트스토어 링크가 없는 작업물도 올릴 수 있나요?

가능하다. 그 경우 상세 설명에서 문의 유도 중심으로 작성한다.

## 10. 운영 인수 시 꼭 전달할 내용

- slug 변경 주의
- `draft/published` 상태 의미
- 대표 이미지 중요성
- 주소/운영시간 변경 시 `SiteSettings` 먼저 수정
- 문의/예약 데이터는 Notion이 아니라 별도 시스템에서 관리된다는 점

