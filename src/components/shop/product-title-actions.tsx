"use client";

import { useState } from "react";
import { ShopShareIcon } from "./shop-icons";
import { ProductWishlistButtonLoader } from "./product-wishlist-button-loader";

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
        <ShopShareIcon />
      </button>
      <ProductWishlistButtonLoader
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
