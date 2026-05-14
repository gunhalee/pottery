"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";

import { useLazyFeedActivation } from "./use-lazy-feed-activation";
import { useGalleryFeedColumns } from "./use-gallery-feed-columns";

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

const fetchLimit = 36;
const initialVisibleRows = 2;
const rowsPerLoad = 2;

export function GalleryInstagramSection({
  activateImmediately = false,
  profileUrl,
}: {
  activateImmediately?: boolean;
  profileUrl: string;
}) {
  const [items, setItems] = useState<InstagramFeedItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [visibleRows, setVisibleRows] = useState(initialVisibleRows);
  const { active: isFeedActive, ref: feedSectionRef } = useLazyFeedActivation();
  const shouldLoadFeed = activateImmediately || isFeedActive;
  const columns = useGalleryFeedColumns();
  const feedItems = useMemo(
    () =>
      items.filter((item) => Boolean(item.thumbnailUrl ?? item.mediaUrl)),
    [items],
  );
  const visibleCount = visibleRows * columns;
  const visibleItems = useMemo(
    () => feedItems.slice(0, visibleCount),
    [feedItems, visibleCount],
  );
  const canLoadMore = visibleCount < feedItems.length;

  useEffect(() => {
    if (!shouldLoadFeed) {
      return;
    }

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
  }, [shouldLoadFeed]);

  if (!loaded || feedItems.length === 0) {
    return (
      <section
        aria-labelledby="gallery-instagram-title"
        className="gallery-instagram-section"
        ref={feedSectionRef}
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
          {isFeedActive && loaded
            ? "인스타그램 피드를 불러오지 못했습니다."
            : "공방의 최근 기록을 준비하고 있습니다."}
        </p>
      </section>
    );
  }

  function showMore() {
    setVisibleRows((current) => current + rowsPerLoad);
  }

  return (
    <section
      aria-labelledby="gallery-instagram-title"
      className="gallery-instagram-section"
      ref={feedSectionRef}
    >
      <div className="gallery-instagram-head">
        <h2 id="gallery-instagram-title">공방 한컷</h2>
        <div className="gallery-feed-actions">
          <a href={profileUrl} rel="noopener noreferrer" target="_blank">
            @pottery_conse
          </a>
        </div>
      </div>
      <div className="gallery-instagram-grid">
        {visibleItems.map((item, index) => {
          const src = item.thumbnailUrl ?? item.mediaUrl;
          const eagerImage = index < columns;

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
                fetchPriority={eagerImage ? "low" : "auto"}
                loading={eagerImage ? "eager" : "lazy"}
                referrerPolicy="no-referrer"
                src={src}
              />
              {item.caption ? <span>{trimCaption(item.caption)}</span> : null}
            </a>
          );
        })}
      </div>
      {canLoadMore ? (
        <div className="gallery-feed-more">
          <button
            aria-label="공방 한컷 2행 더 보기"
            className="gallery-feed-more-button"
            onClick={showMore}
            type="button"
          >
            더보기
          </button>
        </div>
      ) : null}
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
