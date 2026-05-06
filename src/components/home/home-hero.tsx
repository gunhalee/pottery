import Image from "next/image";
import heroPoster from "../../../public/asset/hero-image.jpg";
import { ArtworkImage } from "@/components/media/artwork-image";
import { SiteLink } from "@/components/navigation/site-link";
import { PlaceholderFrame } from "@/components/site/primitives";
import type { HomeHeroAction } from "@/lib/content/site-content";

export type HomeHeroMediaItem = {
  alt: string;
  label: string;
  src?: string;
  tone?: "dark" | "light";
};

const fallbackMosaicItems: HomeHeroMediaItem[] = [
  { alt: "", label: "대표 작품" },
  { alt: "", label: "작품 02", tone: "light" },
  { alt: "", label: "작업 과정", tone: "dark" },
  { alt: "", label: "작품 04", tone: "light" },
  { alt: "", label: "공방 풍경", tone: "light" },
  { alt: "", label: "작품 06", tone: "dark" },
] as const;

export function HomeHero({
  actions,
  mediaItems,
  title,
}: {
  actions: ReadonlyArray<HomeHeroAction>;
  mediaItems: ReadonlyArray<HomeHeroMediaItem>;
  title: string;
}) {
  const mosaicItems = normalizeMosaicItems(mediaItems);

  return (
    <section className="home-hero">
      <div className="hero-mosaic" aria-label="작품 이미지 모음">
        {mosaicItems.map((item, index) => (
          <div className="hero-mosaic-cell" key={`${item.label}-${index}`}>
            {item.src ? (
              <ArtworkImage
                alt={item.alt}
                className="hero-mosaic-image"
                fetchPriority={index === 0 ? "high" : "auto"}
                fill
                loading={index === 0 ? "eager" : "lazy"}
                preload={index === 0}
                quality={70}
                sizes="(max-width: 640px) 50vw, 33vw"
                src={item.src}
              />
            ) : index === 0 ? (
              <Image
                alt=""
                className="hero-mosaic-image"
                fill
                placeholder="blur"
                preload
                quality={70}
                sizes="(max-width: 640px) 50vw, 33vw"
                src={heroPoster}
              />
            ) : (
              <PlaceholderFrame
                className="hero-mosaic-placeholder"
                label={item.label}
                tone={item.tone}
              />
            )}
          </div>
        ))}
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

function normalizeMosaicItems(items: ReadonlyArray<HomeHeroMediaItem>) {
  return [...items, ...fallbackMosaicItems].slice(0, fallbackMosaicItems.length);
}
