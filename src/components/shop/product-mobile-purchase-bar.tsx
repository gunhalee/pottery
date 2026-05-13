"use client";

import {
  ProductCommerceButton,
  ProductGiftIcon,
  ProductHeartIcon,
  ProductNPayLogo,
} from "./product-commerce-primitives";

export type ProductMobilePurchaseBarProps = {
  isFavorite: boolean;
  isFavoriteSaving: boolean;
  isVisible: boolean;
  onGiftCheckout: () => void;
  onNaverPayCheckout: () => void;
  onStandardCheckout: () => void;
  onToggleFavorite: () => void;
  standardCheckoutLabel: string;
};

export function ProductMobilePurchaseBar({
  isFavorite,
  isFavoriteSaving,
  isVisible,
  onGiftCheckout,
  onNaverPayCheckout,
  onStandardCheckout,
  onToggleFavorite,
  standardCheckoutLabel,
}: ProductMobilePurchaseBarProps) {
  return (
    <div
      aria-hidden={!isVisible}
      aria-label="모바일 구매 바"
      className="product-mobile-purchase-bar"
      data-visible={isVisible ? "true" : "false"}
    >
      <ProductCommerceButton
        aria-label="선물하기"
        disabled={!isVisible}
        onClick={onGiftCheckout}
        variant="mobile-gift"
      >
        <ProductGiftIcon />
      </ProductCommerceButton>
      <ProductCommerceButton
        aria-label="N pay 구매하기"
        disabled={!isVisible}
        onClick={onNaverPayCheckout}
        variant="mobile-npay"
      >
        <ProductNPayLogo />
      </ProductCommerceButton>
      <ProductCommerceButton
        disabled={!isVisible}
        onClick={onStandardCheckout}
        variant="mobile-buy"
      >
        {standardCheckoutLabel}
      </ProductCommerceButton>
      <ProductCommerceButton
        aria-label={isFavorite ? "찜 해제" : "찜하기"}
        aria-pressed={isFavorite}
        disabled={!isVisible || isFavoriteSaving}
        onClick={onToggleFavorite}
        variant="mobile-wish"
      >
        <ProductHeartIcon filled={isFavorite} />
      </ProductCommerceButton>
    </div>
  );
}
