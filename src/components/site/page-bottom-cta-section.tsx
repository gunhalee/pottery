import { CtaCardList } from "@/components/site/cta-card-list";
import { Section } from "@/components/site/primitives";
import type { PageCta } from "@/lib/content/page-ctas";

type PageBottomCtaSectionProps = {
  className?: string;
  ctas: readonly PageCta[];
  id?: string;
};

export function PageBottomCtaSection({
  className,
  ctas,
  id,
}: PageBottomCtaSectionProps) {
  return (
    <Section
      className={["intro-gallery-cta", className].filter(Boolean).join(" ")}
      id={id}
    >
      {ctas.length > 1 ? (
        <CtaCardList ctas={ctas} />
      ) : (
        <CtaCardList className="gallery-cta-list-single" ctas={ctas} />
      )}
    </Section>
  );
}
