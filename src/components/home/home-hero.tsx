import Image from "next/image";
import type { HomeHeroTagline } from "@/lib/content/site-content";
import { potOnForestHeroImage } from "@/lib/content/brand-assets";
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
          src={potOnForestHeroImage.src}
          alt=""
          fill
          fetchPriority="high"
          quality={70}
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
            poster={potOnForestHeroImage.src}
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
