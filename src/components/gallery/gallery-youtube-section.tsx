"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type YouTubeFeedItem = {
  description: string | null;
  id: string;
  publishedAt: string | null;
  thumbnail: {
    height: number | null;
    url: string;
    width: number | null;
  } | null;
  title: string;
  url: string;
  videoId: string;
};

type YouTubeFeedPayload = {
  items?: YouTubeFeedItem[];
  ok?: boolean;
};

const feedLimit = 3;

export function GalleryYoutubeSection({
  channelUrl,
}: {
  channelUrl: string;
}) {
  const [items, setItems] = useState<YouTubeFeedItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const visibleItems = useMemo(
    () => items.filter((item) => Boolean(item.thumbnail?.url)).slice(0, feedLimit),
    [items],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadFeed() {
      try {
        const response = await fetch(`/api/youtube?limit=${feedLimit}`, {
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as
          | YouTubeFeedPayload
          | undefined;

        if (!response.ok || !payload?.ok) {
          return;
        }

        setItems(payload.items ?? []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoaded(true);
        }
      }
    }

    loadFeed();

    return () => {
      controller.abort();
    };
  }, []);

  if (!loaded || visibleItems.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="gallery-youtube-title"
      className="gallery-youtube-section"
    >
      <div className="gallery-youtube-head">
        <h2 id="gallery-youtube-title">공방 스케치</h2>
        <a href={channelUrl} rel="noopener noreferrer" target="_blank">
          @consepot
        </a>
      </div>
      <div className="gallery-youtube-grid">
        {visibleItems.map((item) => (
          <a
            aria-label={`YouTube 영상 보기: ${item.title}`}
            className="gallery-youtube-card"
            href={item.url}
            key={item.id}
            rel="noopener noreferrer"
            target="_blank"
          >
            {item.thumbnail ? (
              <span className="gallery-youtube-thumb">
                <Image
                  alt=""
                  aria-hidden="true"
                  fill
                  loading="lazy"
                  sizes="(max-width: 720px) 86vw, (max-width: 1080px) 28vw, 360px"
                  src={item.thumbnail.url}
                />
                <span className="gallery-youtube-play" aria-hidden="true" />
              </span>
            ) : null}
            <span className="gallery-youtube-body">
              <strong>{item.title}</strong>
              {item.publishedAt ? (
                <time dateTime={item.publishedAt}>
                  {formatDate(item.publishedAt)}
                </time>
              ) : null}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
  }).format(date);
}
