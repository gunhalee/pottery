import {
  CtaCardLink,
  ExternalCtaCardLink,
} from "@/components/site/primitives";
import type { PageCta } from "@/lib/content/page-ctas";

type CtaCardListProps = {
  className?: string;
  ctas: readonly PageCta[];
  id?: string;
};

export function CtaCardList({ className, ctas, id }: CtaCardListProps) {
  return (
    <div
      className={["gallery-cta-list", className].filter(Boolean).join(" ")}
      id={id}
    >
      {ctas.map(renderCta)}
    </div>
  );
}

function renderCta(cta: PageCta) {
  if (cta.kind === "external") {
    return (
      <ExternalCtaCardLink href={cta.href} key={cta.label} label={cta.label}>
        <p className="body-copy">{cta.body}</p>
      </ExternalCtaCardLink>
    );
  }

  return (
    <CtaCardLink href={cta.href} key={cta.label} label={cta.label}>
      <p className="body-copy">{cta.body}</p>
    </CtaCardLink>
  );
}
