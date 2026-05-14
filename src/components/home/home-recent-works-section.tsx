import { ArrowLink, Section } from "@/components/site/primitives";
import { ArtworkImage } from "@/components/media/artwork-image";
import { SiteLink } from "@/components/navigation/site-link";
import { getContentListImage } from "@/lib/content-manager/content-images";
import type { ContentEntryListItem } from "@/lib/content-manager/content-model";
import { homeRecentWorkFallbacks } from "@/lib/content/site-content";
import { mediaImageSizes } from "@/lib/media/media-image-sizes";

export function HomeRecentWorksSection({
  entries,
}: {
  entries: ContentEntryListItem[];
}) {
  const recentEntries = entries.slice(0, 3);

  return (
    <Section className="home-recent-works-section" deferred>
      <div className="works-head">
        <h2 className="section-title">작업관의 단서</h2>
        <ArrowLink href="/gallery">작업물 보기</ArrowLink>
      </div>
      {recentEntries.length > 0 ? (
        <div className="grid-3 home-recent-work-grid">
          {recentEntries.map((entry) => {
            const image = getContentListImage(entry);

            return (
              <SiteLink
                className="work-card home-recent-work-card"
                href={`/gallery/${entry.slug}`}
                key={entry.id}
              >
                <span className="home-recent-work-image">
                  {image ? (
                    <ArtworkImage
                      alt={image.alt}
                      className="home-recent-work-img"
                      fill
                      loading="lazy"
                      sizes={mediaImageSizes.galleryCard}
                      src={image.src}
                    />
                  ) : (
                    <span className="home-recent-work-placeholder">
                      작업물
                    </span>
                  )}
                </span>
                <div className="work-name">{entry.title}</div>
                <div className="work-sub">
                  {entry.summary ||
                    entry.displayDate ||
                    entry.publishedAt ||
                    "작업 기록"}
                </div>
              </SiteLink>
            );
          })}
        </div>
      ) : (
        <div className="grid-3 home-recent-work-grid">
          {homeRecentWorkFallbacks.map((entry) => (
            <SiteLink
              className="work-card home-recent-work-card"
              href="/gallery"
              key={entry.title}
            >
              <span className="home-recent-work-image">
                <ArtworkImage
                  alt={entry.imageAlt}
                  className="home-recent-work-img"
                  fill
                  loading="lazy"
                  quality={70}
                  sizes={mediaImageSizes.galleryCard}
                  src={entry.imageSrc}
                />
              </span>
              <div className="work-name">{entry.title}</div>
              <div className="work-sub">{entry.summary}</div>
            </SiteLink>
          ))}
        </div>
      )}
    </Section>
  );
}
