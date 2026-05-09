import Link from "next/link";
import { ArtworkImage } from "@/components/media/artwork-image";
import { PageBottomCtaSection } from "@/components/site/page-bottom-cta-section";
import { PageSocialIntro } from "@/components/site/page-social-intro";
import { PageShell } from "@/components/site/primitives";
import { pageSocialLinks } from "@/lib/config/social-links";
import { pageBottomCtas } from "@/lib/content/page-ctas";
import { getContentListImage } from "@/lib/content-manager/content-images";
import { getPublishedContentListEntries } from "@/lib/content-manager/content-store";
import { mediaImageSizes } from "@/lib/media/media-image-sizes";

export default async function GalleryPage() {
  const galleryItems = await getPublishedContentListEntries("gallery");

  return (
    <>
      <PageShell>
        <PageSocialIntro
          socials={pageSocialLinks.gallery}
          subtitle="완성작과 작업 과정의 기록입니다."
          title="작업물"
        />
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
      </PageShell>
      <PageBottomCtaSection
        className="gallery-cta-section"
        ctas={pageBottomCtas.gallery}
      />
    </>
  );
}
