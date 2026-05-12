"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import type { FocusEvent, KeyboardEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  CheckoutMode,
  ProductOption,
  ShippingMethod,
} from "@/lib/orders/order-model";
import {
  calculateOrderAmounts,
  ORDER_FREE_SHIPPING_THRESHOLD_KRW,
  ORDER_SHIPPING_FEE_KRW,
} from "@/lib/orders/pricing";
import { addCartItem } from "@/lib/shop/cart-storage";
import { dispatchWishlistChanged } from "@/lib/shop/wishlist-events";

type ProductPurchasePanelProps = {
  availabilityLabel: string;
  currency: "KRW";
  isPurchasable: boolean;
  madeToOrder?: {
    daysMax: number;
    daysMin: number;
    enabled: boolean;
    notice?: string;
  };
  maxQuantity: number | null;
  plantOption?: {
    careNotice?: string;
    enabled: boolean;
    priceDelta: number;
    returnNotice?: string;
    shippingRestrictionNotice?: string;
    species?: string;
  };
  price: number | null;
  productSlug: string;
  productTitle: string;
};

type ActionMessage = {
  id: number;
  text: string;
};

const shippingOptions: Array<{
  label: string;
  value: ShippingMethod;
}> = [
  { label: "택배", value: "parcel" },
  { label: "방문수령", value: "pickup" },
];

export function ProductPurchasePanel({
  availabilityLabel,
  currency,
  isPurchasable,
  madeToOrder,
  maxQuantity,
  plantOption,
  price,
  productSlug,
  productTitle,
}: ProductPurchasePanelProps) {
  const router = useRouter();
  const effectiveMaxQuantity = Math.max(1, maxQuantity ?? 99);
  const [quantity, setQuantity] = useState(1);
  const [productOption, setProductOption] =
    useState<ProductOption>("plant_excluded");
  const [isFavorite, setIsFavorite] = useState(false);
  const [isFavoriteSaving, setIsFavoriteSaving] = useState(false);
  const [isCartSaving, setIsCartSaving] = useState(false);
  const [message, setMessage] = useState<ActionMessage | null>(null);
  const [shippingMethod, setShippingMethod] =
    useState<ShippingMethod>("parcel");
  const [isShippingMenuOpen, setIsShippingMenuOpen] = useState(false);
  const favoriteInteractionRef = useRef(false);
  const payRowRef = useRef<HTMLDivElement | null>(null);
  const [isMobilePurchaseBarVisible, setIsMobilePurchaseBarVisible] =
    useState(false);
  const shippingMenuId = useId();
  const clampedQuantity = clampQuantity(quantity, effectiveMaxQuantity);
  const containsLivePlant =
    productOption === "plant_included" && Boolean(plantOption?.enabled);
  const effectiveUnitPrice =
    price === null
      ? null
      : price + (containsLivePlant ? (plantOption?.priceDelta ?? 0) : 0);
  const orderAmounts = calculateOrderAmounts({
    quantity: clampedQuantity,
    shippingMethod,
    unitPrice: effectiveUnitPrice,
  });
  const includedShippingFee = orderAmounts.shippingFeeKrw;
  const orderTotal = orderAmounts.totalKrw;
  const selectedShippingOption =
    shippingOptions.find((option) => option.value === shippingMethod) ??
    shippingOptions[0];

  const formatted = useMemo(
    () => ({
      freeShippingThreshold: formatCurrency(
        ORDER_FREE_SHIPPING_THRESHOLD_KRW,
        currency,
      ),
      shipping: formatCurrency(ORDER_SHIPPING_FEE_KRW, currency),
      total:
        orderTotal === null
          ? "가격 입력 예정"
          : formatCurrency(orderTotal, currency),
      totalNote:
        shippingMethod === "pickup"
          ? "배송비 없음"
          : includedShippingFee > 0
            ? "배송비 포함"
            : "무료배송",
    }),
    [currency, includedShippingFee, orderTotal, shippingMethod],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function readFavoriteState() {
      try {
        const response = await fetch(
          `/api/wishlist?productSlug=${encodeURIComponent(productSlug)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          return;
        }

        const result = (await response.json()) as { wished?: boolean };

        if (!favoriteInteractionRef.current) {
          setIsFavorite(Boolean(result.wished));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    readFavoriteState();

    return () => {
      controller.abort();
    };
  }, [productSlug]);

  useEffect(() => {
    const payRow = payRowRef.current;

    if (!payRow || typeof IntersectionObserver === "undefined") {
      setIsMobilePurchaseBarVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsMobilePurchaseBarVisible(!entry.isIntersecting);
      },
      { threshold: 0.01 },
    );

    observer.observe(payRow);

    return () => {
      observer.disconnect();
    };
  }, []);

  function updateQuantity(nextQuantity: number) {
    setQuantity(clampQuantity(nextQuantity, effectiveMaxQuantity));
  }

  function showPlaceholder(action: string) {
    const prefix = isPurchasable ? action : availabilityLabel;
    setMessage({
      id: Date.now(),
      text: `${prefix} 기능은 결제 연동 후 활성화됩니다.`,
    });
  }

  function startCheckout(checkoutMode: CheckoutMode) {
    if (!isPurchasable || price === null) {
      showPlaceholder(checkoutMode === "gift" ? "선물하기" : "구매하기");
      return;
    }

    const params = new URLSearchParams({
      mode: checkoutMode,
      option: productOption,
      product: productSlug,
      quantity: String(clampedQuantity),
      shipping: shippingMethod,
    });

    if (madeToOrder?.enabled) {
      params.set("order", "made_to_order");
    }

    router.push(`/checkout?${params.toString()}`);
  }

  function addCurrentSelectionToCart() {
    if (!isPurchasable || price === null || effectiveUnitPrice === null) {
      showPlaceholder("장바구니");
      return;
    }

    setIsCartSaving(true);

    try {
      addCartItem(
        {
          madeToOrder: Boolean(madeToOrder?.enabled),
          productOption,
          productSlug,
          quantity: clampedQuantity,
          shippingMethod,
        },
        effectiveMaxQuantity,
      );
      setMessage({
        id: Date.now(),
        text: "장바구니에 담았습니다.",
      });
    } finally {
      setIsCartSaving(false);
    }
  }

  function selectShippingMethod(value: ShippingMethod) {
    setShippingMethod(value);
    setIsShippingMenuOpen(false);
  }

  function handleShippingSelectBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsShippingMenuOpen(false);
    }
  }

  function handleShippingTriggerKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
  ) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setIsShippingMenuOpen(true);
    }

    if (event.key === "Escape") {
      setIsShippingMenuOpen(false);
    }
  }

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
      setMessage({
        id: Date.now(),
        text: "상품 링크를 복사했습니다.",
      });
    } catch {
      setMessage({
        id: Date.now(),
        text: "상품 링크를 복사하지 못했습니다.",
      });
    }
  }

  async function toggleFavorite() {
    const nextFavorite = !isFavorite;

    favoriteInteractionRef.current = true;
    setIsFavorite(nextFavorite);
    setIsFavoriteSaving(true);

    try {
      const response = await fetch("/api/wishlist", {
        body: JSON.stringify({
          productSlug,
          wished: nextFavorite,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        wished?: boolean;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "찜 저장 중 오류가 발생했습니다.");
      }

      const wished = Boolean(result.wished);
      setIsFavorite(wished);
      dispatchWishlistChanged({ productSlug, wished });
      setMessage({
        id: Date.now(),
        text: wished ? "찜에 저장했습니다." : "찜에서 해제했습니다.",
      });
    } catch (error) {
      setIsFavorite(!nextFavorite);
      setMessage({
        id: Date.now(),
        text:
          error instanceof Error
            ? error.message
            : "찜 저장 중 오류가 발생했습니다.",
      });
    } finally {
      setIsFavoriteSaving(false);
    }
  }

  return (
    <div className="product-commerce-panel">
      <div className="product-detail-tools" aria-label="상품 도구">
        <button
          aria-label="상품 공유"
          className="product-icon-button"
          onClick={shareProduct}
          type="button"
        >
          <ShareIcon />
        </button>
        <button
          aria-label={isFavorite ? "찜 해제" : "찜하기"}
          aria-pressed={isFavorite}
          className="product-icon-button"
          disabled={isFavoriteSaving}
          onClick={toggleFavorite}
          type="button"
        >
          <HeartIcon filled={isFavorite} />
        </button>
      </div>

      <dl className="product-commerce-info">
        {plantOption?.enabled ? (
          <div className="product-commerce-row product-option-row">
            <dt>상품 옵션</dt>
            <dd>
              <div className="product-option-toggle" role="group" aria-label="상품 옵션">
                <button
                  aria-pressed={productOption === "plant_excluded"}
                  onClick={() => setProductOption("plant_excluded")}
                  type="button"
                >
                  식물 제외
                </button>
                <button
                  aria-pressed={productOption === "plant_included"}
                  onClick={() => setProductOption("plant_included")}
                  type="button"
                >
                  식물 포함
                  {plantOption.priceDelta > 0 ? (
                    <span>+{formatNumber(plantOption.priceDelta)}원</span>
                  ) : null}
                </button>
              </div>
              {containsLivePlant ? (
                <p className="product-option-note">
                  {plantOption.species
                    ? `${plantOption.species} 구성이 포함됩니다.`
                    : "생화·식물 구성이 포함됩니다."}
                </p>
              ) : null}
            </dd>
          </div>
        ) : null}
        <div className="product-commerce-row product-shipping-method-row">
          <dt>배송 방법</dt>
          <dd>
            <div
              className="product-shipping-select"
              data-open={isShippingMenuOpen ? "true" : "false"}
              onBlur={handleShippingSelectBlur}
            >
              <button
                aria-controls={shippingMenuId}
                aria-expanded={isShippingMenuOpen}
                aria-haspopup="listbox"
                aria-label="배송 방법"
                className="product-shipping-select-trigger"
                onClick={() =>
                  setIsShippingMenuOpen((isCurrentOpen) => !isCurrentOpen)
                }
                onKeyDown={handleShippingTriggerKeyDown}
                type="button"
              >
                <span>{selectedShippingOption.label}</span>
                <span className="product-shipping-select-icon" aria-hidden="true">
                  <ChevronDownIcon />
                </span>
              </button>
              {isShippingMenuOpen ? (
                <div
                  className="product-shipping-options"
                  id={shippingMenuId}
                  role="listbox"
                >
                  {shippingOptions.map((option) => (
                    <button
                      aria-selected={option.value === shippingMethod}
                      className="product-shipping-option"
                      key={option.value}
                      onClick={() => selectShippingMethod(option.value)}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectShippingMethod(option.value);
                      }}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        selectShippingMethod(option.value);
                      }}
                      role="option"
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </dd>
        </div>
        <div className="product-commerce-row">
          <dt>배송</dt>
          <dd className="product-shipping-copy">
            {shippingMethod === "pickup" ? (
              <>
                <span>방문수령 · 별도 배송비 없음</span>
                <strong>방문 가능 일정은 주문 후 안내드립니다.</strong>
              </>
            ) : (
              <>
                <span>
                  택배 · 배송비 {formatted.shipping} ·{" "}
                  {formatted.freeShippingThreshold} 이상 무료배송
                </span>
                <strong>
                  {containsLivePlant
                    ? "식물 포함 상품은 제주·도서산간 배송이 제한됩니다."
                    : "도서산간 배송비는 주문 전 별도 안내드립니다."}
                </strong>
              </>
            )}
          </dd>
        </div>
      </dl>

      {madeToOrder?.enabled ? (
        <div className="product-commerce-notice">
          <strong>추가 제작 주문</strong>
          <p>
            결제 또는 입금 확인일 기준 약 {madeToOrder.daysMin}~
            {madeToOrder.daysMax}일이 소요될 수 있습니다.
          </p>
          {madeToOrder.notice ? <p>{madeToOrder.notice}</p> : null}
        </div>
      ) : null}

      {containsLivePlant ? (
        <div className="product-commerce-notice">
          <strong>식물 포함 상품 안내</strong>
          {plantOption?.careNotice ? <p>{plantOption.careNotice}</p> : null}
          {plantOption?.shippingRestrictionNotice ? (
            <p>{plantOption.shippingRestrictionNotice}</p>
          ) : null}
        </div>
      ) : null}

      <div className="product-quantity-box">
        <div className="product-quantity-head">
          <span>수량</span>
          <div
            className="product-quantity-stepper"
            role="group"
            aria-label="구매 수량"
          >
            <button
              aria-label="수량 줄이기"
              disabled={clampedQuantity <= 1}
              onClick={() => updateQuantity(clampedQuantity - 1)}
              type="button"
            >
              -
            </button>
            <input
              aria-label="구매 수량"
              inputMode="numeric"
              max={effectiveMaxQuantity}
              min={1}
              onChange={(event) => updateQuantity(Number(event.target.value))}
              type="number"
              value={clampedQuantity}
            />
            <button
              aria-label="수량 늘리기"
              disabled={clampedQuantity >= effectiveMaxQuantity}
              onClick={() => updateQuantity(clampedQuantity + 1)}
              type="button"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="product-total-row">
        <span>총 상품금액({clampedQuantity}개)</span>
        <div className="product-total-amount">
          <strong>{formatted.total}</strong>
          <span>{formatted.totalNote}</span>
        </div>
      </div>

      <div className="product-action-grid">
        <button
          className="product-buy-button"
          onClick={() => startCheckout("standard")}
          type="button"
        >
          {madeToOrder?.enabled ? "추가 제작 주문" : "구매하기"}
        </button>
        <button
          className="product-secondary-button"
          onClick={() => startCheckout("gift")}
          type="button"
        >
          <GiftIcon />
          선물하기
        </button>
        <button
          className="product-secondary-button"
          disabled={isCartSaving}
          onClick={addCurrentSelectionToCart}
          type="button"
        >
          {isCartSaving ? "담는 중" : "장바구니"}
        </button>
      </div>

      <div className="product-pay-row" ref={payRowRef}>
        <button
          aria-label="N pay 구매하기"
          className="product-npay-button"
          onClick={() => startCheckout("naver_pay")}
          type="button"
        >
          <Image
            alt=""
            aria-hidden="true"
            className="product-npay-logo"
            height={52}
            src="/asset/logo_npaybk_small.svg"
            width={168}
          />
          구매하기
        </button>
        <button
          aria-label={isFavorite ? "찜 해제" : "찜하기"}
          aria-pressed={isFavorite}
          className="product-wish-button"
          disabled={isFavoriteSaving}
          onClick={toggleFavorite}
          type="button"
        >
          찜
        </button>
      </div>

      <p className="product-commerce-message" aria-live="polite" key={message?.id}>
        {message?.text ?? "\u00a0"}
      </p>

      <div
        aria-hidden={!isMobilePurchaseBarVisible}
        aria-label="모바일 구매 바"
        className="product-mobile-purchase-bar"
        data-visible={isMobilePurchaseBarVisible ? "true" : "false"}
      >
        <button
          aria-label="선물하기"
          className="product-mobile-gift"
          disabled={!isMobilePurchaseBarVisible}
          onClick={() => startCheckout("gift")}
          type="button"
        >
          <GiftIcon />
        </button>
        <button
          aria-label="N pay 구매하기"
          className="product-mobile-npay"
          disabled={!isMobilePurchaseBarVisible}
          onClick={() => startCheckout("naver_pay")}
          type="button"
        >
          <Image
            alt=""
            aria-hidden="true"
            className="product-npay-logo"
            height={52}
            src="/asset/logo_npaybk_small.svg"
            width={168}
          />
        </button>
        <button
          className="product-mobile-buy"
          disabled={!isMobilePurchaseBarVisible}
          onClick={() => startCheckout("standard")}
          type="button"
        >
          {madeToOrder?.enabled ? "추가 제작 주문" : "구매하기"}
        </button>
        <button
          aria-label={isFavorite ? "찜 해제" : "찜하기"}
          aria-pressed={isFavorite}
          className="product-mobile-wish"
          disabled={!isMobilePurchaseBarVisible || isFavoriteSaving}
          onClick={toggleFavorite}
          type="button"
        >
          <HeartIcon filled={isFavorite} />
        </button>
      </div>
    </div>
  );
}

function clampQuantity(value: number, maxQuantity: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(Math.max(1, Math.floor(value)), maxQuantity);
}

function formatCurrency(value: number, currency: "KRW") {
  if (currency === "KRW") {
    return `${formatNumber(value)}원`;
  }

  return `${formatNumber(value)} ${currency}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0,
  }).format(value);
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

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg aria-hidden="true" fill={filled ? "currentColor" : "none"} viewBox="0 0 24 24">
      <path d="M20.4 5.6a5.2 5.2 0 0 0-7.4 0L12 6.7l-1-1.1a5.2 5.2 0 0 0-7.4 7.4l1 1 7.4 7.2 7.4-7.2 1-1a5.2 5.2 0 0 0 0-7.4Z" />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7H8.8a2.2 2.2 0 1 1 2.2-2.2L12 7ZM12 7h3.2A2.2 2.2 0 1 0 13 4.8L12 7Z" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
