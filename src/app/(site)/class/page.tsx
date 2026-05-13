import { ClassCardGrid } from "@/components/site/class-card-grid";
import { ClassReviewPanel } from "@/components/site/class-review-panel";
import { PageBottomCtaSection } from "@/components/site/page-bottom-cta-section";
import { PageShell } from "@/components/site/primitives";
import { pageBottomCtas } from "@/lib/content/page-ctas";
import { classItems, classReviews } from "@/lib/content/site-content";
import { siteConfig } from "@/lib/config/site";
import { getPublishedClassSessions } from "@/lib/shop/class-sessions";
import { getPublishedClassReviews } from "@/lib/shop/class-reviews";

export default async function ClassPage() {
  const [publishedClassReviews, classSessions] = await Promise.all([
    getPublishedClassReviews(),
    getPublishedClassSessions(),
  ]);

  return (
    <>
      <PageShell className="listing-page-shell">
        <h1 className="sr-only">함께하기</h1>

        <ClassCardGrid
          actionHref={siteConfig.naverReservationUrl}
          items={classItems}
        />

        <section className="class-policy-spec-section" aria-label="클래스 안내">
          <dl className="product-spec-list">
            <div className="product-spec-row">
              <dt>예약</dt>
              <dd>
                클래스 예약과 결제는 네이버예약 등 외부 예약 페이지에서
                진행됩니다.
              </dd>
            </div>
            <div className="product-spec-row">
              <dt>취소</dt>
              <dd>
                수업 시작일 기준 3일 전까지 전액 환불, 2일 전 75% 환불, 1일 전
                50% 환불이며 수업 당일 및 노쇼는 환불이 어렵습니다. 최소 인원
                미달 또는 공방 사정으로 취소되는 경우 수업일 7일 전까지 안내 후
                전액 환불합니다.
              </dd>
            </div>
            <div className="product-spec-row">
              <dt>안전</dt>
              <dd>
                공방 내에서는 강사 안내와 안전수칙을 따라주세요. 도구, 물레,
                유약, 건조 중인 작품, 가마 주변 설비는 부주의하게 사용할 경우
                부상 또는 파손 위험이 있습니다.
              </dd>
            </div>
            <div className="product-spec-row">
              <dt>소성·수령</dt>
              <dd>
                작품은 건조, 초벌, 유약 작업, 재벌 과정을 거쳐 완성됩니다. 도자
                작업 특성상 균열, 뒤틀림, 파손, 유약 흐름, 색상 차이가 발생할
                수 있으며 완성 안내 후 30일 이내 수령을 원칙으로 합니다.
              </dd>
            </div>
          </dl>
        </section>

        <ClassReviewPanel
          classSessions={classSessions}
          reviews={publishedClassReviews}
          staticReviews={classReviews}
        />
      </PageShell>
      <PageBottomCtaSection
        className="class-inquiry-cta"
        ctas={pageBottomCtas.class}
        id="class-inquiries"
      />
    </>
  );
}
