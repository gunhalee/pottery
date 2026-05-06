/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import {
  BottomNav,
  MetaLabel,
  PageLinkCards,
  PageIntro,
  PageShell,
} from "@/components/site/primitives";
import { getPublishedContentEntries } from "@/lib/content-manager/content-store";

export default async function GalleryPage() {
  const galleryItems = await getPublishedContentEntries("gallery");

  return (
    <>
      <PageShell>
        <MetaLabel>작품</MetaLabel>
        <PageIntro
          subtitle="완성작과 작업 과정의 기록입니다."
          title="작품"
        />
        <div className="gallery-grid gallery-content-grid">
          {galleryItems.length > 0 ? (
            galleryItems.map((item) => {
              const image =
                item.images.find((entryImage) => entryImage.isListImage) ??
                null;

              return (
                <Link
                  className="gallery-item gallery-content-item"
                  href={`/gallery/${item.slug}`}
                  key={item.id}
                  prefetch={false}
                >
                  {image ? (
                    <img
                      alt={image.alt}
                      decoding="async"
                      height={image.height}
                      loading="lazy"
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
              <span>공개된 작품 아카이브가 아직 없습니다.</span>
            </div>
          )}
        </div>
        <PageLinkCards
          cards={[
            {
              description: "공방에서 준비한 현재 작품을 천천히 살펴보세요.",
              href: "/shop",
              label: "소장",
              title: "이 작품을 곁에 두고 싶다면",
            },
            {
              description: "흙의 감각을 직접 경험하는 시간을 예약해보세요.",
              href: "/class",
              label: "참여",
              title: "직접 만들어 보고 싶다면",
            },
          ]}
        />
      </PageShell>
      <BottomNav
        links={[
          { href: "/shop", label: "작품 소장하기" },
          { href: "/class", label: "클래스 예약" },
        ]}
      />
    </>
  );
}
