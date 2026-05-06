import {
  ArrowLink,
  BottomNav,
  PageIntro,
  QuoteBand,
  Section,
  SplitFeature,
} from "@/components/site/primitives";
import { introFeatures, paletteLabels } from "@/lib/content/site-content";

export default function IntroPage() {
  return (
    <>
      <PageIntro
        subtitle="흙과 손, 쓰임을 중심에 둔 공방입니다."
        title="소개"
      />

      <SplitFeature {...introFeatures[0]} />

      <QuoteBand>
        오래 곁에 두고 쓰는 형태를 천천히 만듭니다.
      </QuoteBand>

      <SplitFeature {...introFeatures[1]} />

      <div className="palette-grid">
        {paletteLabels.map((label) => (
          <div className="palette-cell" key={label}>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <SplitFeature {...introFeatures[2]} />
      <Section className="intro-gallery-cta">
        <div className="intro-cta-card">
          <p className="body-copy">작품을 직접 보고 싶다면</p>
          <ArrowLink href="/gallery">작품 보기</ArrowLink>
        </div>
      </Section>
      <BottomNav
        links={[
          { href: "/gallery", label: "작품 보기" },
          { href: "/news", label: "소식" },
        ]}
      />
    </>
  );
}
