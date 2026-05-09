import Link from "next/link";
import { ArtworkImage } from "@/components/media/artwork-image";
import {
  ArrowLink,
  BottomNav,
  PageIntro,
  PageShell,
  Section,
} from "@/components/site/primitives";
import { getContentListImage } from "@/lib/content-manager/content-images";
import { getPublishedContentListEntries } from "@/lib/content-manager/content-store";
import { mediaImageSizes } from "@/lib/media/media-image-sizes";

export default async function GalleryPage() {
  const galleryItems = await getPublishedContentListEntries("gallery");

  return (
    <>
      <PageShell>
        <PageIntro
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
      <Section className="intro-gallery-cta gallery-cta-section">
        <div className="gallery-cta-list">
          <div className="intro-cta-card">
            <p className="body-copy">작업물을 소장하고 싶다면</p>
            <ArrowLink href="/shop">소장하기</ArrowLink>
          </div>
          <div className="intro-cta-card">
            <p className="body-copy">직접 만들어보고 싶다면</p>
            <ArrowLink href="/class">클래스 신청하기</ArrowLink>
          </div>
        </div>
      </Section>
      <BottomNav
        links={[
          { href: "/shop", label: "소장하기" },
          { href: "/class", label: "클래스 예약" },
        ]}
      />
    </>
  );
}
