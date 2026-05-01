import Link from "next/link";
import {
  ArrowLink,
  ButtonLink,
  PlaceholderFrame,
  Section,
  SectionTitle,
  WorkGrid,
} from "@/components/site/primitives";
import { homeHero, homeQuickLinks, homeWorks } from "@/lib/content/site-content";

export default function HomePage() {
  return (
    <>
      <section className="home-hero">
        <div className="hero-bg" />
        <div className="hero-overlay">
          <div className="hero-eyebrow">{homeHero.eyebrow}</div>
          <h1 className="hero-title">
            {homeHero.title}
            <br />
            <em>{homeHero.titleEmphasis}</em>
          </h1>
          <p className="hero-copy">{homeHero.description}</p>
          <div className="hero-cta">
            <ButtonLink href="/shop">Shop</ButtonLink>
            <ArrowLink href="/intro">Our Story</ArrowLink>
          </div>
        </div>
        <div className="hero-scroll">
          <div className="scroll-line" />
          <span>Scroll</span>
        </div>
      </section>

      <Section className="split">
        <PlaceholderFrame className="story-image" label="Brand Image" />
        <div>
          <SectionTitle emphasis="Headline">Brand Story</SectionTitle>
          <p className="body-copy">
            느린 제작 방식과 절제된 형태를 바탕으로, 오래 곁에 두고 쓰는 도자
            작품을 만듭니다. 공방의 분위기와 작업 철학을 소개합니다.
          </p>
          <ArrowLink href="/intro">Read More</ArrowLink>
        </div>
      </Section>

      <Section>
        <div className="works-head">
          <h2 className="section-title">Recent Works</h2>
          <ArrowLink href="/shop">View All</ArrowLink>
        </div>
        <WorkGrid items={homeWorks} />
      </Section>

      <Section className="quick-grid">
        {homeQuickLinks.map((item) => (
          <Link href={item.href} className="quick-card" key={item.href}>
            <div className="small-caps">{item.eyebrow}</div>
            <h3 className="card-title">{item.title}</h3>
            <p className="body-copy">{item.description}</p>
            <span className="link-arrow">View</span>
          </Link>
        ))}
      </Section>
    </>
  );
}
