import Link from "next/link";
import { DeferredGalleryInstagramSection } from "@/components/gallery/deferred-gallery-instagram-section";
import { DeferredGalleryYoutubeSection } from "@/components/gallery/deferred-gallery-youtube-section";
import { ArtworkImage } from "@/components/media/artwork-image";
import { PageBottomCtaSection } from "@/components/site/page-bottom-cta-section";
import { PageIntro, PageShell } from "@/components/site/primitives";
import { siteConfig } from "@/lib/config/site";
import { pageBottomCtas } from "@/lib/content/page-ctas";
import { galleryFallbackItems } from "@/lib/content/site-content";
import { getContentListImage } from "@/lib/content-manager/content-images";
import { getPublishedContentListEntries } from "@/lib/content-manager/content-store";
import { mediaImageSizes } from "@/lib/media/media-image-sizes";

export default async function GalleryPage() {
  const galleryItems = await getPublishedContentListEntries("gallery");

  return (
    <>
      <PageShell className="listing-page-shell">
        <PageIntro
          subtitle="초록을 담는 형태, 흙의 질감, 작은 생명이 놓이는 장면을 작업물로 기록합니다."
          title="작업물"
          variant="compact"
        />
        <div className="gallery-grid gallery-content-grid">
          {galleryItems.length > 0 ? (
            galleryItems.map((item, index) => {
              const image = getContentListImage(item);

              return (
                <Link
                  className="gallery-item gallery-content-item"
                  href={`/gallery/${item.slug}`}
                  key={item.id}
                  prefetch={false}
                >
                  {image ? (
                    <ArtworkImage
                      alt={image.alt}
                      fetchPriority={index === 0 ? "high" : "auto"}
                      fill
                      height={image.height}
                      loading={index < 2 ? "eager" : "lazy"}
                      quality={70}
                      sizes={mediaImageSizes.galleryCard}
                      src={image.src}
                      width={image.width}
                    />
                  ) : null}
                  <span>{item.title}</span>
                </Link>
              );
            })
          ) : galleryFallbackItems.length > 0 ? (
            galleryFallbackItems.map((item, index) => (
              <div
                className="gallery-item gallery-content-item"
                key={item.title}
              >
                <ArtworkImage
                  alt={item.imageAlt}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  fill
                  loading={index < 2 ? "eager" : "lazy"}
                  quality={70}
                  sizes={mediaImageSizes.galleryCard}
                  src={item.imageSrc}
                />
                <span>{item.title}</span>
              </div>
            ))
          ) : (
            <div className="gallery-item gallery-content-empty">
              <span>공개된 작업물이 아직 없습니다.</span>
            </div>
          )}
        </div>
        <DeferredGalleryInstagramSection profileUrl={siteConfig.instagramUrl} />
        <DeferredGalleryYoutubeSection channelUrl={siteConfig.youtubeUrl} />
      </PageShell>
      <PageBottomCtaSection
        className="gallery-cta-section"
        ctas={pageBottomCtas.gallery}
      />
    </>
  );
}
