import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { FeatureSection, WorkItem } from "@/lib/content/site-content";

type LinkHref = ComponentProps<typeof Link>["href"];

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
    <Link href={href} className="button-primary">
      {children}
    </Link>
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
    <a className="button-primary" href={href}>
      {children}
    </a>
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
    <Link href={href} className="link-arrow">
      {children}
    </Link>
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
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cx("section", className)}>{children}</section>;
}

export function PageIntro({
  subtitle,
  title,
  titleEmphasis,
}: {
  subtitle: string;
  title: string;
  titleEmphasis?: string;
}) {
  return (
    <div className="page-intro">
      <h1 className="page-title">
        {title}
        {titleEmphasis ? (
          <>
            {" "}
            <em>{titleEmphasis}</em>
          </>
        ) : null}
      </h1>
      <p className="page-subtitle">{subtitle}</p>
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

export function WorkGrid({ items }: { items: WorkItem[] }) {
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
          </>
        );

        return item.href ? (
          <Link href={item.href} className="work-card" key={item.placeholder}>
            {card}
          </Link>
        ) : (
          <article className="work-card" key={item.placeholder}>
            {card}
          </article>
        );
      })}
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
