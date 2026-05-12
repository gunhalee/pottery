"use client";

import { useState } from "react";
import { ProductWishlistButton } from "./product-wishlist-button";

type ProductTitleActionsProps = {
  productSlug: string;
  productTitle: string;
};

export function ProductTitleActions({
  productSlug,
  productTitle,
}: ProductTitleActionsProps) {
  const [message, setMessage] = useState("");

  async function shareProduct() {
    const shareData = {
      title: productTitle,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(window.location.href);
      setMessage("상품 링크를 복사했습니다.");
    } catch {
      setMessage("상품 링크를 복사하지 못했습니다.");
    }
  }

  return (
    <div className="product-detail-tools" aria-label="상품 도구">
      <button
        aria-label="상품 공유"
        className="product-icon-button"
        onClick={shareProduct}
        type="button"
      >
        <ShareIcon />
      </button>
      <ProductWishlistButton
        className="product-icon-button"
        productSlug={productSlug}
        productTitle={productTitle}
      />
      <span className="sr-only" role="status">
        {message}
      </span>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4" />
    </svg>
  );
}
