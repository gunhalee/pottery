import {
  BottomNav,
  MetaLabel,
  PageLinkCards,
  PageIntro,
  PageShell,
} from "@/components/site/primitives";
import { galleryItems } from "@/lib/content/site-content";

export default function GalleryPage() {
  return (
    <>
      <PageShell>
        <MetaLabel>Gallery</MetaLabel>
        <PageIntro
          subtitle="작품과 작업 과정의 분위기를 한눈에 볼 수 있는 아카이브입니다."
          title="Works Archive"
        />
        <div className="gallery-grid">
          {galleryItems.map((item, index) => (
            <div
              className={`gallery-item ${
                "featured" in item && item.featured ? "featured" : ""
              }`}
              data-title={item.title}
              key={`${item.title}-${index}`}
            />
          ))}
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
