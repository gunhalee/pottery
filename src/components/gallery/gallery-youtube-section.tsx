"use client";

import Image from "next/image";
import {
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  const [selectedItem, setSelectedItem] = useState<YouTubeFeedItem | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    if (!selectedItem) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedItem(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedItem]);

  if (!loaded || visibleItems.length === 0) {
    return null;
  }

  function closeVideo() {
    setSelectedItem(null);
  }

  function handleOverlayMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      closeVideo();
    }
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
          <button
            aria-label={`사이트 안에서 YouTube 영상 재생: ${item.title}`}
            className="gallery-youtube-card"
            key={item.id}
            onClick={() => {
              setSelectedItem(item);
            }}
            type="button"
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
          </button>
        ))}
      </div>
      {selectedItem ? (
        <div
          className="gallery-youtube-overlay"
          onMouseDown={handleOverlayMouseDown}
          role="presentation"
        >
          <div
            aria-labelledby="gallery-youtube-modal-title"
            aria-modal="true"
            className="gallery-youtube-dialog"
            role="dialog"
          >
            <button
              aria-label="영상 닫기"
              className="gallery-youtube-close"
              onClick={closeVideo}
              ref={closeButtonRef}
              type="button"
            >
              닫기
            </button>
            <div className="gallery-youtube-player">
              <iframe
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                src={getEmbedUrl(selectedItem.videoId)}
                title={selectedItem.title}
              />
            </div>
            <div className="gallery-youtube-modal-meta">
              <h3 id="gallery-youtube-modal-title">{selectedItem.title}</h3>
              {selectedItem.publishedAt ? (
                <time dateTime={selectedItem.publishedAt}>
                  {formatDate(selectedItem.publishedAt)}
                </time>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function getEmbedUrl(videoId: string) {
  const params = new URLSearchParams({
    autoplay: "1",
    modestbranding: "1",
    playsinline: "1",
    rel: "0",
  });

  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
    videoId,
  )}?${params.toString()}`;
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
