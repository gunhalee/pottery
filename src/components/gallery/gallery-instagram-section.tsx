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

const fetchLimit = 24;
const pageSize = 3;

export function GalleryInstagramSection({
  profileUrl,
}: {
  profileUrl: string;
}) {
  const [items, setItems] = useState<InstagramFeedItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [startIndex, setStartIndex] = useState(0);
  const feedItems = useMemo(
    () =>
      items.filter((item) => Boolean(item.thumbnailUrl ?? item.mediaUrl)),
    [items],
  );
  const lastPageStart = getLastPageStart(feedItems.length);
  const currentStartIndex = Math.min(startIndex, lastPageStart);
  const visibleItems = useMemo(
    () => feedItems.slice(currentStartIndex, currentStartIndex + pageSize),
    [currentStartIndex, feedItems],
  );
  const hasPrevious = currentStartIndex > 0;
  const hasNext = currentStartIndex + pageSize < feedItems.length;
  const canPaginate = feedItems.length > pageSize;

  useEffect(() => {
    const controller = new AbortController();

    async function loadFeed() {
      try {
        const response = await fetch(`/api/instagram?limit=${fetchLimit}`, {
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

  if (!loaded || feedItems.length === 0) {
    return null;
  }

  function goPrevious() {
    setStartIndex((current) =>
      Math.max(0, Math.min(current, lastPageStart) - pageSize),
    );
  }

  function goNext() {
    setStartIndex((current) =>
      Math.min(Math.min(current, lastPageStart) + pageSize, lastPageStart),
    );
  }

  return (
    <section
      aria-labelledby="gallery-instagram-title"
      className="gallery-instagram-section"
    >
      <div className="gallery-instagram-head">
        <h2 id="gallery-instagram-title">공방 한컷</h2>
        <div className="gallery-feed-actions">
          <a href={profileUrl} rel="noopener noreferrer" target="_blank">
            @pottery_conse
          </a>
          {canPaginate ? (
            <div className="gallery-feed-pager" aria-label="공방 한컷 더 보기">
              <button
                aria-label="이전 공방 한컷 보기"
                className="gallery-feed-arrow"
                disabled={!hasPrevious}
                onClick={goPrevious}
                type="button"
              >
                <span aria-hidden="true">‹</span>
              </button>
              <button
                aria-label="다음 공방 한컷 3개 보기"
                className="gallery-feed-arrow"
                disabled={!hasNext}
                onClick={goNext}
                type="button"
              >
                <span aria-hidden="true">›</span>
              </button>
            </div>
          ) : null}
        </div>
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

function getLastPageStart(total: number) {
  if (total <= pageSize) {
    return 0;
  }

  return Math.floor((total - 1) / pageSize) * pageSize;
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
