import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import Link from "next/link";
import heroPoster from "../../../public/asset/hero-image.jpg";
import {
  ArrowLink,
  PlaceholderFrame,
  Section,
  SectionTitle,
  WorkGrid,
} from "@/components/site/primitives";
import { homeWorks } from "@/lib/content/site-content";

const homeEntryCards = [
  {
    description: "현재 소장 가능한 작품들",
    href: "/shop",
    label: "Shop",
    title: "작품 소장",
  },
  {
    description: "원데이 · 정기 클래스",
    href: "/class",
    label: "Class",
    title: "직접 해보기",
  },
  {
    description: "작업 과정과 완성작",
    href: "/gallery",
    label: "Gallery",
    title: "작품 아카이브",
  },
  {
    description: "일정 · 신작 · 작업 일지",
    href: "/news",
    label: "News",
    title: "공방 소식",
  },
] as const;

const heroVideoSrc = existsSync(
  join(process.cwd(), "public", "asset", "hero-video.mp4"),
)
  ? "/asset/hero-video.mp4"
  : null;

export default function HomePage() {
  return (
    <>
      <section className="home-hero">
        <div className="hero-bg" aria-hidden="true">
          <Image
            src={heroPoster}
            alt=""
            fill
            priority
            placeholder="blur"
            sizes="100vw"
            className="hero-poster"
          />
          <video
            className="hero-video"
            autoPlay
            loop
            muted
            playsInline
            poster="/asset/hero-image.jpg"
            preload="metadata"
          >
            {heroVideoSrc ? (
              <source src={heroVideoSrc} type="video/mp4" />
            ) : null}
          </video>
        </div>
        <div className="hero-overlay">
          <h1 className="hero-title">Headline Text Here</h1>
          <div className="hero-cta">
            <Link
              href="/shop"
              className="hero-button hero-button-primary"
              prefetch={false}
            >
              Shop
            </Link>
            <Link
              href="/class"
              className="hero-button hero-button-ghost"
              prefetch={false}
            >
              Class
            </Link>
          </div>
        </div>
      </section>

      <section className="home-entry-grid fade-in" aria-label="주요 페이지">
        {homeEntryCards.map((item) => (
          <Link
            href={item.href}
            className="home-entry-card"
            key={item.href}
            prefetch={false}
          >
            <div className="small-caps">{item.label}</div>
            <h2 className="card-title">{item.title}</h2>
            <p>{item.description}</p>
          </Link>
        ))}
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
    </>
  );
}
