import {
  ExternalButtonLink,
  ExternalCtaCardLink,
  FollowCTA,
  PageIntro,
  PageShell,
  Section,
} from "@/components/site/primitives";
import { classItems, classReviews } from "@/lib/content/site-content";
import { siteConfig } from "@/lib/config/site";

export default function ClassPage() {
  return (
    <>
      <PageShell>
        <PageIntro
          subtitle="흙을 만지고 형태를 만드는 시간을 예약하세요."
          title="함께하기"
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

        <FollowCTA title="다음 클래스 오픈 소식을 받으려면" />

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
      <Section className="intro-gallery-cta class-inquiry-cta" id="class-inquiries">
        <ExternalCtaCardLink
          href={siteConfig.kakaoChannelUrl}
          label="카카오채널 문의하기"
        >
          <p className="body-copy">클래스 문의를 하고 싶다면</p>
        </ExternalCtaCardLink>
      </Section>
    </>
  );
}
