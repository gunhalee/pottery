import Link from "next/link";
import { DeferredGalleryInstagramSection } from "@/components/gallery/deferred-gallery-instagram-section";
import { DeferredGalleryYoutubeSection } from "@/components/gallery/deferred-gallery-youtube-section";
import { ArtworkImage } from "@/components/media/artwork-image";
import { PageBottomCtaSection } from "@/components/site/page-bottom-cta-section";
import { PageShell } from "@/components/site/primitives";
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
        <h1 className="sr-only">작업물</h1>
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
              <Link
                className="gallery-item gallery-content-item"
                href="/shop"
                key={item.title}
                prefetch={false}
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
              </Link>
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
