import {
  PageIntro,
  QuoteBand,
  SplitFeature,
} from "@/components/site/primitives";
import { introFeatures, paletteLabels } from "@/lib/content/site-content";

export default function IntroPage() {
  return (
    <>
      <PageIntro
        subtitle="흙과 손, 쓰임을 중심에 둔 공방입니다."
        title="About"
        titleEmphasis="Us"
      />

      <SplitFeature {...introFeatures[0]} />

      <QuoteBand>
        Brand Philosophy
        <br />
        Statement Goes Here
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
