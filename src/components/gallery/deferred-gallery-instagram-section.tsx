"use client";

import dynamic from "next/dynamic";
import { useDeferredActivation } from "@/lib/browser/use-deferred-activation";

const GalleryInstagramSection = dynamic(
  () =>
    import("./gallery-instagram-section").then(
      (mod) => mod.GalleryInstagramSection,
    ),
  { ssr: false },
);

export function DeferredGalleryInstagramSection({
  profileUrl,
}: {
  profileUrl: string;
}) {
  const { active, ref } = useDeferredActivation<HTMLElement>({
    idleTimeout: 900,
    rootMargin: "1600px 0px",
  });

  if (active) {
    return <GalleryInstagramSection activateImmediately profileUrl={profileUrl} />;
  }

  return (
    <section
      aria-labelledby="gallery-instagram-title"
      className="gallery-instagram-section"
      ref={ref}
    >
      <div className="gallery-instagram-head">
        <h2 id="gallery-instagram-title">공방 피드</h2>
        <div className="gallery-feed-actions">
          <a href={profileUrl} rel="noopener noreferrer" target="_blank">
            @pottery_conse
          </a>
        </div>
      </div>
      <p className="gallery-feed-placeholder">
        공방의 최근 기록을 준비하고 있습니다.
      </p>
    </section>
  );
}
