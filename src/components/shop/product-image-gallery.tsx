"use client";

import { useEffect, useMemo, useState } from "react";
import { ArtworkImage } from "@/components/media/artwork-image";
import { mediaImageSizes } from "@/lib/media/media-image-sizes";

export type ProductGalleryImage = {
  alt: string;
  height?: number;
  id: string;
  src: string;
  thumbnailHeight?: number;
  thumbnailSrc?: string;
  thumbnailWidth?: number;
  width?: number;
};

type PreloadPhase = "none" | "adjacent" | "all";

export function ProductImageGallery({
  images,
  productTitle,
}: {
  images: ProductGalleryImage[];
  productTitle: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [preloadPhase, setPreloadPhase] = useState<PreloadPhase>("none");
  const activeImage = images[activeIndex] ?? images[0];
  const hasMultipleImages = images.length > 1;
  const preloadIndexes = useMemo(
    () => getPreloadIndexes(images.length, activeIndex, preloadPhase),
    [activeIndex, images.length, preloadPhase],
  );

  useEffect(() => {
    if (!hasMultipleImages) {
      return;
    }

    const cancelAdjacentPreload = scheduleWhenIdle(
      () => setPreloadPhase("adjacent"),
      700,
    );
    let cancelFullPreload: (() => void) | undefined;
    const fullPreloadTimer = window.setTimeout(() => {
      cancelFullPreload = scheduleWhenIdle(() => setPreloadPhase("all"), 1200);
    }, 900);

    return () => {
      cancelAdjacentPreload();
      cancelFullPreload?.();
      window.clearTimeout(fullPreloadTimer);
    };
  }, [hasMultipleImages, images.length]);

  function showImage(index: number) {
    if (images.length === 0) {
      return;
    }

    const nextIndex = (index + images.length) % images.length;
    setActiveIndex(nextIndex);
  }

  if (!activeImage) {
    return null;
  }

  return (
    <div className="product-image-gallery">
      <div className="product-gallery-main">
        <ArtworkImage
          alt={activeImage.alt}
          className="product-detail-image product-detail-photo"
          fill
          loading="eager"
          preload={activeIndex === 0}
          sizes={mediaImageSizes.productDetailHero}
          src={activeImage.src}
        />
        {hasMultipleImages ? (
          <>
            <button
              aria-label="이전 이미지 보기"
              className="product-gallery-arrow product-gallery-arrow-prev"
              onClick={() => showImage(activeIndex - 1)}
              type="button"
            >
              <ChevronLeftIcon />
            </button>
            <button
              aria-label="다음 이미지 보기"
              className="product-gallery-arrow product-gallery-arrow-next"
              onClick={() => showImage(activeIndex + 1)}
              type="button"
            >
              <ChevronRightIcon />
            </button>
          </>
        ) : null}
      </div>

      {hasMultipleImages ? (
        <div className="product-detail-gallery" aria-label={`${productTitle} 이미지 목록`}>
          {images.map((image, index) => (
            <button
              aria-label={`${index + 1}번 이미지 보기`}
              aria-pressed={index === activeIndex}
              className="product-gallery-thumb"
              key={image.id}
              onClick={() => showImage(index)}
              type="button"
            >
              <ArtworkImage
                alt=""
                fill
                loading="lazy"
                sizes={mediaImageSizes.productDetailThumbnail}
                src={image.thumbnailSrc ?? image.src}
              />
            </button>
          ))}
        </div>
      ) : null}

      {preloadIndexes.length > 0 ? (
        <div aria-hidden="true" className="product-gallery-preload">
          {preloadIndexes.map((index) => {
            const image = images[index];

            return image ? (
              <ArtworkImage
                alt=""
                fetchPriority="low"
                height={image.height}
                key={`preload-${image.id}`}
                loading="eager"
                sizes={mediaImageSizes.productDetailHero}
                src={image.src}
                width={image.width}
              />
            ) : null;
          })}
        </div>
      ) : null}
    </div>
  );
}

function getPreloadIndexes(
  imageCount: number,
  activeIndex: number,
  preloadPhase: PreloadPhase,
) {
  if (imageCount < 2 || preloadPhase === "none") {
    return [];
  }

  const indexes: number[] = [];
  const addIndex = (index: number) => {
    const normalizedIndex = (index + imageCount) % imageCount;

    if (normalizedIndex !== activeIndex && !indexes.includes(normalizedIndex)) {
      indexes.push(normalizedIndex);
    }
  };

  addIndex(activeIndex + 1);
  addIndex(activeIndex - 1);

  if (preloadPhase === "all") {
    for (let index = 0; index < imageCount; index += 1) {
      addIndex(index);
    }
  }

  return indexes;
}

function scheduleWhenIdle(callback: () => void, timeout: number) {
  const browserWindow = window as Window & {
    cancelIdleCallback?: (handle: number) => void;
    requestIdleCallback?: (
      callback: () => void,
      options?: { timeout: number },
    ) => number;
  };

  if (typeof browserWindow.requestIdleCallback === "function") {
    const handle = browserWindow.requestIdleCallback(callback, { timeout });

    return () => browserWindow.cancelIdleCallback?.(handle);
  }

  const handle = window.setTimeout(callback, timeout);

  return () => window.clearTimeout(handle);
}

function ChevronLeftIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m15 5-7 7 7 7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}
