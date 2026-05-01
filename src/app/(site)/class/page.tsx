import {
  ExternalButtonLink,
  PageIntro,
  PageShell,
} from "@/components/site/primitives";
import { classItems, classReviews } from "@/lib/content/site-content";
import { siteConfig } from "@/lib/config/site";

export default function ClassPage() {
  return (
    <PageShell>
      <PageIntro
        subtitle="흙을 만지고 형태를 만드는 시간을 예약하세요."
        title="Class"
        titleEmphasis="Info"
      />

      <div className="class-grid section-gap">
        {classItems.map((item) => (
          <article className="class-card" key={item.eyebrow}>
            <div className="small-caps">{item.eyebrow}</div>
            <h2 className="card-title">{item.title}</h2>
            <p className="body-copy">{item.description}</p>
            <ul className="detail-list">
              {item.details.map((detail) => (
                <li key={detail.label}>
                  {detail.label}
                  <span>{detail.value}</span>
                </li>
              ))}
            </ul>
            <ExternalButtonLink href={siteConfig.kakaoChannelUrl}>
              {item.action}
            </ExternalButtonLink>
          </article>
        ))}
      </div>

      <div>
        <div className="review-title">Reviews</div>
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
  );
}
