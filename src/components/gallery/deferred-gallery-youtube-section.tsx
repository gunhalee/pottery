"use client";

import dynamic from "next/dynamic";
import { useDeferredActivation } from "@/lib/browser/use-deferred-activation";

const GalleryYoutubeSection = dynamic(
  () =>
    import("./gallery-youtube-section").then((mod) => mod.GalleryYoutubeSection),
  { ssr: false },
);

export function DeferredGalleryYoutubeSection({
  channelUrl,
}: {
  channelUrl: string;
}) {
  const { active, ref } = useDeferredActivation<HTMLElement>({
    idleTimeout: 2600,
    rootMargin: "720px 0px",
  });

  if (active) {
    return <GalleryYoutubeSection activateImmediately channelUrl={channelUrl} />;
  }

  return (
    <section
      aria-labelledby="gallery-youtube-title"
      className="gallery-youtube-section"
      ref={ref}
    >
      <div className="gallery-youtube-head">
        <h2 id="gallery-youtube-title">공방 영상</h2>
        <div className="gallery-feed-actions">
          <a href={channelUrl} rel="noopener noreferrer" target="_blank">
            @consepot
          </a>
        </div>
      </div>
      <p className="gallery-feed-placeholder">
        공방의 영상 기록을 준비하고 있습니다.
      </p>
    </section>
  );
}
