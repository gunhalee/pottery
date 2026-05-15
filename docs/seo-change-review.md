# SEO 변경 검토 메모

작성일: 2026-05-15

이 문서는 SEO 고도화 중 실제 콘텐츠와 브랜드 톤에 영향을 줄 수 있는 변경을 따로 검토하기 위한 체크리스트다. 기술 구현은 대부분 검색엔진용 표식이지만, 일부 문구는 방문자가 직접 보게 되므로 운영자 확인이 필요하다.

## 제목 정책

사용자 요청에 맞춰 사이트 이름이 먼저 보이는 형식으로 정리했다.

- 기본 형식: `콩새와 도자기공방 | 경기도 광주 ...`
- 홈 title: `콩새와 도자기공방 | 경기도 광주 능평동 도자기 클래스와 수공예 도자`
- 서브 페이지 title: 루트 템플릿이 `콩새와 도자기공방 | {페이지명}` 형태로 렌더링한다.

관련 파일:

- `src/app/layout.tsx`
- `src/app/(site)/page.tsx`
- `src/app/(site)/intro/page.tsx`
- `src/app/(site)/class/page.tsx`
- `src/app/(site)/gallery/page.tsx`
- `src/app/(site)/news/page.tsx`
- `src/app/(site)/shop/page.tsx`

## 우선 검토할 내용

아래 항목은 기술 SEO를 넘어서 사이트의 실제 인상이나 운영 약속처럼 보일 수 있다. 배포 전 문구 확인을 권장한다.

| 우선순위 | 위치 | 변경 성격 | 검토 포인트 |
| --- | --- | --- | --- |
| 높음 | `src/app/(site)/intro/page.tsx` | `애견동반` 안내 섹션 추가 | 반려견 동반이 상시 가능한지, 예약 전 확인이 충분한 조건인지, 현장 운영 기준과 맞는지 확인 필요 |
| 높음 | `src/app/(site)/class/page.tsx` | 클래스 페이지에 반려견 동반 안내 섹션 추가 | 수업 중 동반 가능 범위, 다른 참여자 배려 기준, 예약 문의 동선이 실제 운영과 맞는지 확인 필요 |
| 중간 | `src/lib/config/site.ts` | 사이트 공통 description에 `애견동반 가능 공방` 포함 | 처리됨: 공통 description을 기존의 차분한 소개 문구로 되돌림 |
| 중간 | `src/lib/content/site-content.ts` | 홈 hero 문구에 `경기도 광주시 능평동`과 `동물의 이야기` 추가 | 첫 화면 브랜드 톤이 너무 검색어 중심으로 느껴지지 않는지 확인 필요 |
| 중간 | `class/page.tsx`, `gallery/page.tsx`, `news/page.tsx`, `shop/page.tsx` | 페이지 소개 문구에 지역 키워드 추가 | 처리됨: 클래스/작업물 소개 문구는 기존 문구로, 소식/소장하기는 기존 `sr-only` 제목 구조로 되돌림. 각 페이지 metadata description도 지역 반복을 줄임 |
| 낮음 | `src/app/(site)/shop/[slug]/page.tsx` | 상품 상세 메타 설명에 `경기 광주 능평동 공방에서 만든...` 추가 | 처리됨: 상품 상세 metadata description은 Supabase 상품의 `shortDescription`만 사용 |
| 낮음 | `docs/seo-strategy.md` | SEO 전략 문서 업데이트 | `오포권`은 사용 금지로 정리했고, `오포/오포읍`은 보조 검색어로만 다룸 |

## 덜 침습적인 대안

운영 정책이나 톤이 아직 확정되지 않았다면 아래처럼 낮출 수 있다.

- `애견동반 가능` -> `반려견 동반은 예약 전 문의`
- `애견동반 가능한 도자기 공방` -> `반려견 동반 방문을 예약 전 조율할 수 있는 도자기 공방`
- 페이지 상단의 지역 반복을 줄이고, 지역 키워드는 title/description/JSON-LD 중심으로 유지
- 홈 hero에서는 지역명을 짧게 두고, 자세한 위치와 동반 안내는 소개 페이지로 이동

## 반영된 원상복구

- `siteConfig.description`: `애견동반 가능 공방` 확정 표현 제거
- `class/page.tsx`: 상단 소개 문구에서 `경기 광주 능평동`과 반려견 동반 조율 문장 제거
- `gallery/page.tsx`: 상단 소개 문구에서 지역 문구 제거
- `news/page.tsx`: 새로 노출한 `PageIntro`를 기존의 숨김 제목 구조로 복구
- `shop/page.tsx`: 새로 노출한 `PageIntro`를 기존의 숨김 제목 구조로 복구
- `class/page.tsx`, `gallery/page.tsx`, `news/page.tsx`, `shop/page.tsx`: 검색 결과에 쓰일 수 있는 metadata description에서도 반복 지역 문구 완화
- `shop/[slug]/page.tsx`: 상품마다 붙던 지역 접미사 제거

## 유지해도 비교적 안전한 기술 변경

아래 항목은 방문자-facing 카피보다 검색엔진/공유/색인 제어에 가까운 변경이다.

- `robots.ts`, `sitemap.ts` 추가
- 관리자, 주문, 결제, 장바구니, 찜 목록 noindex 처리
- canonical URL 정리
- Organization, LocalBusiness, WebSite, BreadcrumbList, Product, Article/CreativeWork JSON-LD 추가
- Supabase에서 내려오는 상품/콘텐츠 데이터를 이용한 상세 페이지 metadata 생성

## 운영자 확인 질문

- 반려견 동반은 모든 클래스/방문에 가능한가, 아니면 예약 전 조율 조건인가?
- 사이트 문구에서는 `애견동반`과 `반려견 동반` 중 어떤 표현을 주로 사용할까?
- title은 `경기도 광주`를 우선하고, 본문 주소는 `경기도 광주시 능평동`으로 쓰는 방향이 맞는가?
- `오포/오포읍`은 실제 검색 대응용으로 소개/오시는 길에서만 짧게 설명할까, 아니면 현재 사이트에서는 아예 노출하지 않을까?
- 홈 첫 화면에 지역 SEO 문구를 넣는 것이 브랜드 톤과 맞는가?

## 권장 판단

현재 상태에서는 기술 SEO는 유지하고, visible copy는 아래 두 곳을 가장 먼저 확인하면 된다.

1. `intro` 페이지의 반려견 동반 섹션
2. `class` 페이지의 반려견 동반 섹션

이 두 섹션이 실제 운영과 맞다면 나머지 문구는 비교적 작은 톤 조정의 문제다. 반대로 동반 정책이 확정되지 않았다면 `애견동반 가능`을 전역에서 완화 표현으로 바꾸는 편이 안전하다.
