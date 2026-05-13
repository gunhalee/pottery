"use client";

import { useState } from "react";
import { ArtworkImage } from "@/components/media/artwork-image";
import { mediaImageSizes } from "@/lib/media/media-image-sizes";
import type { ProductGalleryImage } from "@/lib/shop/product-images";
import { ShopChevronLeftIcon, ShopChevronRightIcon } from "./shop-icons";

type ProductGalleryArrowDirection = "next" | "previous";

const galleryArrowClassNameByDirection = {
  next: "product-gallery-arrow-next",
  previous: "product-gallery-arrow-prev",
} satisfies Record<ProductGalleryArrowDirection, string>;

export function ProductImageGalleryCarousel({
  images,
  productTitle,
}: {
  images: ProductGalleryImage[];
  productTitle: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex] ?? images[0];

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
          fetchPriority={activeIndex === 0 ? "high" : "auto"}
          fill
          loading={activeIndex === 0 ? "eager" : "lazy"}
          preload={activeIndex === 0}
          quality={70}
          sizes={mediaImageSizes.productDetailHero}
          src={activeImage.src}
        />
        <ProductGalleryArrowButton
          direction="previous"
          label="이전 이미지 보기"
          onClick={() => showImage(activeIndex - 1)}
        />
        <ProductGalleryArrowButton
          direction="next"
          label="다음 이미지 보기"
          onClick={() => showImage(activeIndex + 1)}
        />
      </div>

      <div className="product-detail-gallery" aria-label={`${productTitle} 이미지 목록`}>
        {images.map((image, index) => (
          <button
            aria-label={`${index + 1}번째 이미지 보기`}
            aria-pressed={index === activeIndex}
            className="product-gallery-thumb"
            key={image.id}
            onClick={() => showImage(index)}
            type="button"
          >
            <ArtworkImage
              alt=""
              fetchPriority="low"
              fill
              loading="lazy"
              quality={70}
              sizes={mediaImageSizes.productDetailThumbnail}
              src={image.thumbnailSrc ?? image.src}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function ProductGalleryArrowButton({
  direction,
  label,
  onClick,
}: {
  direction: ProductGalleryArrowDirection;
  label: string;
  onClick: () => void;
}) {
  const Icon =
    direction === "previous" ? ShopChevronLeftIcon : ShopChevronRightIcon;

  return (
    <button
      aria-label={label}
      className={`product-gallery-arrow ${galleryArrowClassNameByDirection[direction]}`}
      onClick={onClick}
      type="button"
    >
      <Icon />
    </button>
  );
}
