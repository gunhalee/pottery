import Image from "next/image";
import heroPoster from "../../../public/asset/hero-image.jpg";
import { SiteLink } from "@/components/navigation/site-link";
import type { HomeHeroAction } from "@/lib/content/site-content";

export function HomeHero({
  actions,
  title,
  videoSrc,
}: {
  actions: ReadonlyArray<HomeHeroAction>;
  title: string;
  videoSrc: string | null;
}) {
  return (
    <section className="home-hero">
      <div className="hero-bg" aria-hidden="true">
        <Image
          src={heroPoster}
          alt=""
          fill
          preload
          quality={70}
          placeholder="blur"
          sizes="100vw"
          className="hero-poster"
        />
        {videoSrc ? (
          <video
            className="hero-video"
            autoPlay
            loop
            muted
            playsInline
            poster="/asset/hero-image.jpg"
            preload="metadata"
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        ) : null}
      </div>
      <div className="hero-overlay">
        <h1 className="hero-title">{title}</h1>
        <div className="hero-cta">
          {actions.map((action) => (
            <SiteLink
              href={action.href}
              className={`hero-button hero-button-${action.tone}`}
              key={action.label}
            >
              {action.label}
            </SiteLink>
          ))}
        </div>
      </div>
    </section>
  );
}
