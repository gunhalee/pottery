import Image from "next/image";
import heroPoster from "../../../public/asset/hero-poster.webp";
import type { HomeHeroTagline } from "@/lib/content/site-content";
import { mediaImageSizes } from "@/lib/media/media-image-sizes";

export function HomeHero({
  taglines,
  title,
  videoSrc,
}: {
  taglines: ReadonlyArray<HomeHeroTagline>;
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
          fetchPriority="high"
          quality={70}
          placeholder="blur"
          sizes={mediaImageSizes.homeHero}
          className="hero-poster"
        />
        {videoSrc ? (
          <video
            className="hero-video"
            autoPlay
            loop
            muted
            playsInline
            poster="/asset/hero-poster.webp"
            preload="metadata"
          >
            <source src={videoSrc} type="video/mp4" />
          </video>
        ) : null}
      </div>
      <div className="hero-overlay">
        <h1 className="hero-title">{title}</h1>
        <div className="hero-taglines" aria-label="태그라인">
          {taglines.map((tagline) => (
            <span className="hero-tagline" key={tagline}>
              {tagline}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
