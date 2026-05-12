import {
  PageIntro,
  PageShell,
  QuoteBand,
  SplitFeature,
} from "@/components/site/primitives";
import { introFeatures, paletteLabels } from "@/lib/content/site-content";

export default function IntroPage() {
  return (
    <>
      <PageShell className="intro-page-header">
        <PageIntro
          subtitle="흙과 손, 쓰임을 중심에 둔 공방입니다."
          title="콩새와 도자기 공방은"
          variant="editorial"
        />
      </PageShell>

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
    </>
  );
}
