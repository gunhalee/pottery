"use client";

import Link from "next/link";
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
import {
  dispatchWishlistChanged,
  wishlistChangedEventName,
  type WishlistChangedDetail,
} from "@/lib/shop/wishlist-events";
import { scheduleWhenIdle } from "@/lib/browser/schedule-when-idle";
import {
  ProductCommerceButton,
  ProductGiftIcon,
  ProductNPayLogo,
  ProductQuantityStepper,
  ProductShippingSelect,
} from "./product-commerce-primitives";
import { ProductMobilePurchaseBarLoader } from "./product-mobile-purchase-bar-loader";

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
  const shippingMenuId = useId();
  const payRowId = useId();
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
  const shippingPeriodNotice = getShippingPeriodNotice({
    madeToOrder,
    shippingMethod,
  });
  const standardCheckoutLabel = madeToOrder?.enabled
    ? "추가 제작 주문"
    : "구매하기";

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
    const cancel = scheduleWhenIdle(readFavoriteState, 1400);

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

    return () => {
      cancel();
      controller.abort();
    };
  }, [productSlug]);

  useEffect(() => {
    function syncFavoriteState(event: Event) {
      const detail = (event as CustomEvent<WishlistChangedDetail>).detail;

      if (detail?.productSlug !== productSlug) {
        return;
      }

      favoriteInteractionRef.current = true;
      setIsFavorite(detail.wished);
    }

    window.addEventListener(wishlistChangedEventName, syncFavoriteState);

    return () => {
      window.removeEventListener(wishlistChangedEventName, syncFavoriteState);
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

  async function addCurrentSelectionToCart() {
    if (!isPurchasable || price === null || effectiveUnitPrice === null) {
      showPlaceholder("장바구니");
      return;
    }

    setIsCartSaving(true);

    try {
      await addCartItem({
        madeToOrder: Boolean(madeToOrder?.enabled),
        productOption,
        productSlug,
        quantity: clampedQuantity,
        shippingMethod,
      });
      setMessage({
        id: Date.now(),
        text: "장바구니에 담았습니다.",
      });
    } catch (error) {
      setMessage({
        id: Date.now(),
        text:
          error instanceof Error
            ? error.message
            : "장바구니 저장 중 오류가 발생했습니다.",
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
            <ProductShippingSelect
              isOpen={isShippingMenuOpen}
              label="배송 방법"
              menuId={shippingMenuId}
              onBlur={handleShippingSelectBlur}
              onSelect={selectShippingMethod}
              onToggle={() =>
                setIsShippingMenuOpen((isCurrentOpen) => !isCurrentOpen)
              }
              onTriggerKeyDown={handleShippingTriggerKeyDown}
              options={shippingOptions}
              selectedLabel={selectedShippingOption.label}
              selectedValue={shippingMethod}
            />
          </dd>
        </div>
        <div className="product-commerce-row">
          <dt>배송</dt>
          <dd className="product-shipping-copy">
            {shippingMethod === "pickup" ? (
              <>
                <span>방문수령 · 별도 배송비 없음</span>
                <strong>
                  방문수령은 결제 후 15일 이내 수령을 원칙으로 합니다.
                </strong>
              </>
            ) : (
              <>
                <span>
                  택배 · 배송비 {formatted.shipping}
                </span>
                <span>
                  {formatted.freeShippingThreshold} 이상 무료배송
                </span>
                <strong>{shippingPeriodNotice}</strong>
                <span>
                  {containsLivePlant
                    ? "식물 포함 상품은 제주·도서산간 배송이 제한됩니다."
                    : "도서산간 배송비는 주문 전 별도 안내드립니다."}
                </span>
                <Link
                  className="product-shipping-policy-link"
                  href="/shipping-returns"
                  prefetch={false}
                >
                  배송·교환·환불 안내 보기
                </Link>
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
          <p>
            식물 포함 선택 시 수령 지연이나 관리 상태에 따라 교환·반품 조건이
            달라질 수 있습니다. 자세한 안내는 체크아웃에서 확인해 주세요.
          </p>
        </div>
      ) : null}

      <div className="product-quantity-box">
        <div className="product-quantity-head">
          <span>수량</span>
          <ProductQuantityStepper
            decreaseLabel="수량 줄이기"
            increaseLabel="수량 늘리기"
            inputLabel="구매 수량"
            max={effectiveMaxQuantity}
            onChange={updateQuantity}
            value={clampedQuantity}
          />
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
        <ProductCommerceButton
          onClick={() => startCheckout("standard")}
          variant="buy"
        >
          {standardCheckoutLabel}
        </ProductCommerceButton>
        <ProductCommerceButton
          onClick={() => startCheckout("gift")}
          variant="secondary"
        >
          <ProductGiftIcon />
          선물하기
        </ProductCommerceButton>
        <ProductCommerceButton
          disabled={isCartSaving}
          onClick={addCurrentSelectionToCart}
          variant="secondary"
        >
          {isCartSaving ? "담는 중" : "장바구니"}
        </ProductCommerceButton>
      </div>

      <div className="product-pay-row" id={payRowId}>
        <ProductCommerceButton
          aria-label="N pay 구매하기"
          onClick={() => startCheckout("naver_pay")}
          variant="npay"
        >
          <ProductNPayLogo />
          구매하기
        </ProductCommerceButton>
        <ProductCommerceButton
          aria-label={isFavorite ? "찜 해제" : "찜하기"}
          aria-pressed={isFavorite}
          disabled={isFavoriteSaving}
          onClick={toggleFavorite}
          variant="wish"
        >
          찜
        </ProductCommerceButton>
      </div>

      <p className="product-commerce-message" aria-live="polite" key={message?.id}>
        {message?.text ?? "\u00a0"}
      </p>

      <ProductMobilePurchaseBarLoader
        isFavorite={isFavorite}
        isFavoriteSaving={isFavoriteSaving}
        onGiftCheckout={() => startCheckout("gift")}
        onNaverPayCheckout={() => startCheckout("naver_pay")}
        onStandardCheckout={() => startCheckout("standard")}
        onToggleFavorite={toggleFavorite}
        payRowId={payRowId}
        standardCheckoutLabel={standardCheckoutLabel}
      />
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

function getShippingPeriodNotice({
  madeToOrder,
  shippingMethod,
}: {
  madeToOrder: ProductPurchasePanelProps["madeToOrder"];
  shippingMethod: ShippingMethod;
}) {
  if (shippingMethod === "pickup") {
    return "방문수령은 결제 후 15일 이내 수령을 원칙으로 합니다.";
  }

  if (madeToOrder?.enabled) {
    return `제작 상품은 결제 후 ${madeToOrder.daysMin}~${madeToOrder.daysMax}일의 제작 기간이 필요하며, 제작 완료 후 발송됩니다.`;
  }

  return "결제 후 2~5영업일 이내 발송을 원칙으로 합니다.";
}
