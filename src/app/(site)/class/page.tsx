import { ClassCardGrid } from "@/components/site/class-card-grid";
import { ClassReviewConsentForm } from "@/components/site/class-review-consent-form";
import { PageShell } from "@/components/site/primitives";
import { PageBottomCtaSection } from "@/components/site/page-bottom-cta-section";
import { pageBottomCtas } from "@/lib/content/page-ctas";
import { classItems, classReviews } from "@/lib/content/site-content";
import { siteConfig } from "@/lib/config/site";

export default function ClassPage() {
  return (
    <>
      <PageShell className="listing-page-shell">
        <h1 className="sr-only">함께하기</h1>

        <ClassCardGrid
          actionHref={siteConfig.naverReservationUrl}
          items={classItems}
        />

        <section className="product-policy-section class-policy-section" aria-label="클래스 안내">
          <div className="policy-notice">
            <h2>예약·취소 안내</h2>
            <p>클래스 예약과 결제는 네이버예약 등 외부 예약 페이지에서 진행됩니다.</p>
            <p>
              수업 시작일 기준 3일 전까지 전액 환불, 2일 전 75% 환불, 1일 전
              50% 환불이며 수업 당일 및 노쇼는 환불이 어렵습니다.
            </p>
            <p>
              최소 인원 미달 또는 공방 사정으로 클래스가 취소되는 경우 수업일
              7일 전까지 안내하며 전액 환불합니다.
            </p>
          </div>
          <div className="policy-notice">
            <h2>안전수칙</h2>
            <p>
              공방 내에서는 강사 안내와 안전수칙을 따라주세요. 도구, 물레,
              유약, 건조 중인 작품, 가마 주변 설비는 부주의하게 사용할 경우
              부상 또는 파손 위험이 있습니다.
            </p>
            <p>
              도구는 안내 받은 용도로만 사용하고, 가마/설비 접근 및 타인의 작품
              접촉은 삼가 주세요.
            </p>
          </div>
          <div className="policy-notice">
            <h2>소성·수령 안내</h2>
            <p>
              작품은 건조, 초벌, 유약 작업, 재벌 과정을 거쳐 완성됩니다. 도자
              작업 특성상 균열, 뒤틀림, 파손, 유약 흐름, 색상 차이가 발생할 수
              있습니다.
            </p>
            <p>
              완성 안내 후 30일 이내 수령을 원칙으로 하며, 60일이 지나도록
              수령이 이루어지지 않는 작품은 보관 여건에 따라 폐기 또는 별도
              처리될 수 있습니다.
            </p>
          </div>
        </section>

        <div>
          <div className="review-title">후기</div>
          <div className="review-grid">
            {classReviews.map((review) => (
              <figure className="review" key={review.quote}>
                <q>{review.quote}</q>
                <cite>{review.cite}</cite>
              </figure>
            ))}
          </div>
        </div>

        <ClassReviewConsentForm />
      </PageShell>
      <PageBottomCtaSection
        className="class-inquiry-cta"
        ctas={pageBottomCtas.class}
        id="class-inquiries"
      />
    </>
  );
}
