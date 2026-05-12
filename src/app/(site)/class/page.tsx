import { ClassCardGrid } from "@/components/site/class-card-grid";
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
          actionHref={siteConfig.kakaoChannelUrl}
          items={classItems}
        />

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
      </PageShell>
      <PageBottomCtaSection
        className="class-inquiry-cta"
        ctas={pageBottomCtas.class}
        id="class-inquiries"
      />
    </>
  );
}
