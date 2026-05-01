import {
  MetaLabel,
  PageIntro,
  PageShell,
} from "@/components/site/primitives";
import { galleryItems } from "@/lib/content/site-content";

export default function GalleryPage() {
  return (
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
    </PageShell>
  );
}
