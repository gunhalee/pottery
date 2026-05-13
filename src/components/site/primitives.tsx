import type { ReactNode } from "react";
import { SiteLink } from "@/components/navigation/site-link";
import {
  SiteActionLink,
  SiteArrowLink,
  SiteArrowText,
  SiteExternalActionLink,
  SiteExternalArrowLink,
} from "@/components/site/actions";
import type { AppHref } from "@/lib/routing/types";
import type { FeatureSection, WorkItem } from "@/lib/content/site-content";

type LinkHref = AppHref;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function ButtonLink({
  children,
  href,
}: {
  children: ReactNode;
  href: LinkHref;
}) {
  return (
    <SiteActionLink href={href}>
      {children}
    </SiteActionLink>
  );
}

export function ExternalButtonLink({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) {
  return (
    <SiteExternalActionLink href={href}>
      {children}
    </SiteExternalActionLink>
  );
}

export function ArrowLink({
  children,
  href,
}: {
  children: ReactNode;
  href: LinkHref;
}) {
  return (
    <SiteArrowLink href={href}>
      {children}
    </SiteArrowLink>
  );
}

export function CtaCardLink({
  children,
  href,
  label,
}: {
  children: ReactNode;
  href: LinkHref;
  label: ReactNode;
}) {
  return (
    <SiteLink href={href} className="intro-cta-card">
      {children}
      <SiteArrowText>{label}</SiteArrowText>
    </SiteLink>
  );
}

export function ExternalCtaCardLink({
  children,
  href,
  label,
}: {
  children: ReactNode;
  href: string;
  label: ReactNode;
}) {
  return (
    <a
      className="intro-cta-card"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
      <SiteArrowText>{label}</SiteArrowText>
    </a>
  );
}

export function MetaLabel({ children }: { children: ReactNode }) {
  return <div className="meta-label">{children}</div>;
}

export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cx("section page-shell", className)}>{children}</section>;
}

export function Section({
  children,
  className,
  deferred = false,
  id,
}: {
  children: ReactNode;
  className?: string;
  deferred?: boolean;
  id?: string;
}) {
  return (
    <section
      className={cx("section", deferred && "deferred-section", className)}
      id={id}
    >
      {children}
    </section>
  );
}

export function PageIntro({
  subtitle,
  title,
  titleEmphasis,
  variant = "editorial",
}: {
  subtitle?: ReactNode;
  title: string;
  titleEmphasis?: string;
  variant?: "compact" | "editorial";
}) {
  const hasSubtitle = Boolean(subtitle);

  return (
    <div
      className={cx(
        "page-intro",
        `page-intro-${variant}`,
        hasSubtitle && "page-intro-has-subtitle",
      )}
    >
      <div className="page-intro-copy">
        <h1 className="page-title">
          {title}
          {titleEmphasis ? (
            <>
              {" "}
              <em>{titleEmphasis}</em>
            </>
          ) : null}
        </h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
    </div>
  );
}

export function SectionTitle({
  children,
  emphasis,
}: {
  children: ReactNode;
  emphasis?: ReactNode;
}) {
  return (
    <h2 className="section-title">
      {children}
      {emphasis ? (
        <>
          <br />
          <em>{emphasis}</em>
        </>
      ) : null}
    </h2>
  );
}

export function PlaceholderFrame({
  className,
  label,
  tone = "light",
}: {
  className?: string;
  label: string;
  tone?: "light" | "dark";
}) {
  return (
    <div
      className={cx("ph", tone === "dark" && "ph-dark", className)}
      data-ph={label}
    />
  );
}

export function SplitFeature({
  eyebrow,
  imageLabel,
  imageTone = "light",
  imageVariant = "portrait",
  paragraphs,
  reverse,
  title,
  titleEmphasis,
}: FeatureSection) {
  return (
    <Section className={cx("split", reverse && "reverse")}>
      <PlaceholderFrame
        className={imageVariant === "wide" ? "wide-image" : "portrait-image"}
        label={imageLabel}
        tone={imageTone}
      />
      <div>
        <MetaLabel>{eyebrow}</MetaLabel>
        <SectionTitle emphasis={titleEmphasis}>{title}</SectionTitle>
        {paragraphs.map((paragraph) => (
          <p className="body-copy" key={paragraph}>
            {paragraph}
          </p>
        ))}
      </div>
    </Section>
  );
}

export function WorkGrid({
  inquiryHref,
  items,
}: {
  inquiryHref?: string;
  items: WorkItem[];
}) {
  return (
    <div className="grid-3">
      {items.map((item) => {
        const card = (
          <>
            <PlaceholderFrame
              className="work-image"
              label={item.placeholder}
              tone={item.tone}
            />
            <div className="work-name">{item.title}</div>
            <div className="work-sub">{item.description}</div>
            {item.price ? <div className="work-price">{item.price}</div> : null}
            {inquiryHref ? (
              <SiteExternalArrowLink
                className="work-inquiry"
                href={inquiryHref}
              >
                문의하기
              </SiteExternalArrowLink>
            ) : null}
          </>
        );

        return item.href ? (
          <SiteLink href={item.href} className="work-card" key={item.placeholder}>
            {card}
          </SiteLink>
        ) : (
          <article className="work-card" key={item.placeholder}>
            {card}
          </article>
        );
      })}
    </div>
  );
}

export function PageLinkCards({
  cards,
}: {
  cards: ReadonlyArray<{
    description: string;
    href: LinkHref;
    label: string;
    title: string;
  }>;
}) {
  return (
    <div className="page-link-cards">
      {cards.map((card) => (
        <SiteLink
          className="page-link-card"
          href={card.href}
          key={card.label}
        >
          <div className="small-caps">{card.label}</div>
          <h2 className="card-title">{card.title}</h2>
          <p className="body-copy">{card.description}</p>
          <SiteArrowText>{card.label}하기</SiteArrowText>
        </SiteLink>
      ))}
    </div>
  );
}

export function QuoteBand({ children }: { children: ReactNode }) {
  return (
    <div className="quote-band">
      <q>{children}</q>
    </div>
  );
}
