"use client";

import Image from "next/image";
import type { FocusEvent, KeyboardEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

type ProductPurchasePanelProps = {
  availabilityLabel: string;
  currency: "KRW";
  isPurchasable: boolean;
  maxQuantity: number | null;
  price: number | null;
  productSlug: string;
  productTitle: string;
};

type ActionMessage = {
  id: number;
  text: string;
};

type ShippingMethod = "parcel" | "pickup";

const shippingFee = 4000;
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
  maxQuantity,
  price,
  productSlug,
  productTitle,
}: ProductPurchasePanelProps) {
  const effectiveMaxQuantity = Math.max(1, maxQuantity ?? 99);
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isFavoriteSaving, setIsFavoriteSaving] = useState(false);
  const [message, setMessage] = useState<ActionMessage | null>(null);
  const [shippingMethod, setShippingMethod] =
    useState<ShippingMethod>("parcel");
  const [isShippingMenuOpen, setIsShippingMenuOpen] = useState(false);
  const favoriteInteractionRef = useRef(false);
  const shippingMenuId = useId();
  const clampedQuantity = clampQuantity(quantity, effectiveMaxQuantity);
  const productTotal = price === null ? null : price * clampedQuantity;
  const includedShippingFee = shippingMethod === "parcel" ? shippingFee : 0;
  const orderTotal =
    productTotal === null ? null : productTotal + includedShippingFee;
  const selectedShippingOption =
    shippingOptions.find((option) => option.value === shippingMethod) ??
    shippingOptions[0];

  const formatted = useMemo(
    () => ({
      shipping: formatCurrency(shippingFee, currency),
      total:
        orderTotal === null
          ? "가격 입력 예정"
          : formatCurrency(orderTotal, currency),
      totalNote: shippingMethod === "parcel" ? "배송비 포함" : "배송비 없음",
    }),
    [currency, orderTotal, shippingMethod],
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
                <span>택배 · 배송비 {formatted.shipping} · 도서산간 배송비 별도</span>
              </>
            )}
          </dd>
        </div>
      </dl>

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
          onClick={() => showPlaceholder("구매하기")}
          type="button"
        >
          구매하기
        </button>
        <button
          className="product-secondary-button"
          onClick={() => showPlaceholder("선물하기")}
          type="button"
        >
          <GiftIcon />
          선물하기
        </button>
        <button
          className="product-secondary-button"
          onClick={() => showPlaceholder("장바구니")}
          type="button"
        >
          장바구니
        </button>
      </div>

      <div className="product-pay-row">
        <button
          aria-label="N pay 구매하기"
          className="product-npay-button"
          onClick={() => showPlaceholder("N pay 구매하기")}
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

      <div className="product-mobile-purchase-bar" aria-label="모바일 구매 바">
        <button
          aria-label="선물하기"
          className="product-mobile-gift"
          onClick={() => showPlaceholder("선물하기")}
          type="button"
        >
          <GiftIcon />
        </button>
        <button
          aria-label="N pay 구매하기"
          className="product-mobile-npay"
          onClick={() => showPlaceholder("N pay 구매하기")}
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
          onClick={() => showPlaceholder("구매하기")}
          type="button"
        >
          구매하기
        </button>
        <button
          aria-label={isFavorite ? "찜 해제" : "찜하기"}
          aria-pressed={isFavorite}
          className="product-mobile-wish"
          disabled={isFavoriteSaving}
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
