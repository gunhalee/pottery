import Link from "next/link";
import { GalleryInstagramSection } from "@/components/gallery/gallery-instagram-section";
import { HomeSubscribeLinksSection } from "@/components/home/home-subscribe-links-section";
import { ArtworkImage } from "@/components/media/artwork-image";
import { PageBottomCtaSection } from "@/components/site/page-bottom-cta-section";
import { PageShell } from "@/components/site/primitives";
import { siteConfig } from "@/lib/config/site";
import { artworkSubscribeLinks } from "@/lib/config/social-links";
import { pageBottomCtas } from "@/lib/content/page-ctas";
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
            galleryItems.map((item) => {
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
                      fill
                      height={image.height}
                      loading="lazy"
                      sizes={mediaImageSizes.galleryCard}
                      src={image.src}
                      width={image.width}
                    />
                  ) : null}
                  <span>{item.title}</span>
                </Link>
              );
            })
          ) : (
            <div className="gallery-item gallery-content-empty">
              <span>공개된 초록과 도자기가 아직 없습니다.</span>
            </div>
          )}
        </div>
        <GalleryInstagramSection profileUrl={siteConfig.instagramUrl} />
      </PageShell>
      <PageBottomCtaSection
        className="gallery-cta-section"
        ctas={pageBottomCtas.gallery}
      />
      <HomeSubscribeLinksSection
        ariaLabel="작업물 구독 링크"
        className="page-subscribe-section"
        links={artworkSubscribeLinks}
        title="제작 과정이 궁금하다면"
      />
    </>
  );
}
