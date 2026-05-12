"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";

type InstagramFeedItem = {
  caption: string | null;
  id: string;
  mediaType: string;
  mediaUrl: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  timestamp: string | null;
  username: string | null;
};

type InstagramFeedPayload = {
  items?: InstagramFeedItem[];
  ok?: boolean;
};

const feedLimit = 6;

export function GalleryInstagramSection({
  profileUrl,
}: {
  profileUrl: string;
}) {
  const [items, setItems] = useState<InstagramFeedItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const visibleItems = useMemo(
    () =>
      items
        .filter((item) => Boolean(item.thumbnailUrl ?? item.mediaUrl))
        .slice(0, feedLimit),
    [items],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadFeed() {
      try {
        const response = await fetch(`/api/instagram?limit=${feedLimit}`, {
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as
          | InstagramFeedPayload
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
      aria-labelledby="gallery-instagram-title"
      className="gallery-instagram-section"
    >
      <div className="gallery-instagram-head">
        <h2 id="gallery-instagram-title">공방 한컷</h2>
        <a href={profileUrl} rel="noopener noreferrer" target="_blank">
          @pottery_conse
        </a>
      </div>
      <div className="gallery-instagram-grid">
        {visibleItems.map((item) => {
          const src = item.thumbnailUrl ?? item.mediaUrl;

          if (!src) {
            return null;
          }

          return (
            <a
              aria-label={getItemLabel(item)}
              className="gallery-instagram-item"
              href={item.permalink ?? profileUrl}
              key={item.id}
              rel="noopener noreferrer"
              target="_blank"
            >
              <img
                alt={item.caption ?? "콩새와 도자기공방 인스타그램 사진"}
                decoding="async"
                loading="lazy"
                referrerPolicy="no-referrer"
                src={src}
              />
              {item.caption ? <span>{trimCaption(item.caption)}</span> : null}
            </a>
          );
        })}
      </div>
    </section>
  );
}

function getItemLabel(item: InstagramFeedItem) {
  if (item.caption) {
    return `Instagram 게시물: ${trimCaption(item.caption)}`;
  }

  return "Instagram 게시물 보기";
}

function trimCaption(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  return normalized.length > 80 ? `${normalized.slice(0, 80)}...` : normalized;
}
