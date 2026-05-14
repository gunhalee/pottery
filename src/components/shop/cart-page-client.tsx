"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArtworkImage } from "@/components/media/artwork-image";
import {
  CommerceQuantityStepper,
  CommerceSummaryList,
} from "@/components/site/commerce-form-primitives";
import {
  SiteActionButton,
  SiteActionLink,
  SiteEmptyState,
} from "@/components/site/actions";
import type { ProductOption } from "@/lib/orders/order-model";
import {
  calculateOrderAmounts,
  ORDER_FREE_SHIPPING_THRESHOLD_KRW,
  ORDER_SHIPPING_FEE_KRW,
} from "@/lib/orders/pricing";
import {
  artworkPlaceholderImage,
  getArtworkPlaceholderAlt,
} from "@/lib/media/media-placeholders";
import { mediaImageSizes } from "@/lib/media/media-image-sizes";
import {
  cartChangedEventName,
  clearCart,
  getCartItemCount,
  getCartItemKey,
  readCartSnapshot,
  removeCartItem,
  updateCartItemQuantity,
  type CartItem,
  type CartSnapshot,
} from "@/lib/shop/cart-storage";
import { getProductCartImage } from "@/lib/shop/product-images";
import {
  getProductPurchaseLimitQuantity,
  type ProductImage,
  type ProductListItem,
} from "@/lib/shop/product-model";

type CartPageClientProps = {
  initialSnapshot: CartSnapshot;
  products: ProductListItem[];
};

type CartRow = {
  amountLabel: string;
  canCheckout: boolean;
  checkoutHref: string;
  image: ProductImage | null;
  item: CartItem;
  key: string;
  maxQuantity: number;
  product: ProductListItem | null;
  productOption: ProductOption;
  statusText: string;
  subtotal: number;
  total: number;
  unitPrice: number | null;
};

const emptySnapshot: CartSnapshot = {
  items: [],
  updatedAt: "",
  version: 1,
};

export function CartPageClient({
  initialSnapshot,
  products,
}: CartPageClientProps) {
  const [hasHydrated, setHasHydrated] = useState(true);
  const [snapshot, setSnapshot] = useState<CartSnapshot>(
    initialSnapshot ?? emptySnapshot,
  );
  const productBySlug = useMemo(
    () => new Map(products.map((product) => [product.slug, product])),
    [products],
  );
  const rows = useMemo(
    () =>
      snapshot.items.map((item) =>
        createCartRow({
          item,
          product: productBySlug.get(item.productSlug) ?? null,
        }),
      ),
    [productBySlug, snapshot.items],
  );
  const itemCount = getCartItemCount(snapshot);
  const estimatedSubtotal = rows.reduce((total, row) => total + row.subtotal, 0);
  const estimatedTotal = rows.reduce((total, row) => total + row.total, 0);
  const freeShippingRemaining = Math.max(
    0,
    ORDER_FREE_SHIPPING_THRESHOLD_KRW - estimatedSubtotal,
  );
  const containsLivePlant = rows.some(
    (row) => row.productOption === "plant_included",
  );
  const containsMadeToOrder = rows.some((row) => row.item.madeToOrder);

  useEffect(() => {
    let active = true;

    async function syncCart() {
      try {
        const nextSnapshot = await readCartSnapshot();

        if (active) {
          setSnapshot(nextSnapshot);
        }
      } finally {
        if (active) {
          setHasHydrated(true);
        }
      }
    }

    function syncCartFromEvent(event: Event) {
      const detail = (event as CustomEvent<{ snapshot?: CartSnapshot }>).detail;

      if (detail?.snapshot) {
        setSnapshot(detail.snapshot);
      }
    }

    void syncCart();
    window.addEventListener(cartChangedEventName, syncCartFromEvent);

    return () => {
      active = false;
      window.removeEventListener(cartChangedEventName, syncCartFromEvent);
    };
  }, []);

  async function updateQuantity(key: string, quantity: number) {
    setSnapshot(await updateCartItemQuantity(key, quantity));
  }

  async function removeItem(key: string) {
    setSnapshot(await removeCartItem(key));
  }

  async function removeAllItems() {
    setSnapshot(await clearCart());
  }

  if (!hasHydrated) {
    return (
      <SiteEmptyState
        className="shop-subpage-empty"
        title="장바구니를 확인하고 있습니다."
      >
        <p>장바구니를 불러오고 있습니다.</p>
      </SiteEmptyState>
    );
  }

  if (rows.length === 0) {
    return (
      <SiteEmptyState
        action={<SiteActionLink href="/shop">소장하기로 이동</SiteActionLink>}
        className="shop-subpage-empty"
        title="장바구니가 비어 있습니다."
      >
        <p>소장하고 싶은 작업물을 장바구니에 담아 보세요.</p>
      </SiteEmptyState>
    );
  }

  return (
    <div className="cart-layout">
      <div className="cart-list" aria-label="장바구니 상품">
        {rows.map((row) => (
          <article className="cart-item" key={row.key}>
            <Link
              className="cart-item-image-link"
              href={`/shop/${row.item.productSlug}`}
              prefetch={false}
            >
              {row.image?.src ? (
                <ArtworkImage
                  alt={row.image.alt}
                  className="cart-item-image"
                  fill
                  loading="lazy"
                  sizes={mediaImageSizes.cartItem}
                  src={row.image.src}
                />
              ) : (
                <ArtworkImage
                  alt={getArtworkPlaceholderAlt(row.product?.titleKo)}
                  className="cart-item-image"
                  fill
                  loading="lazy"
                  sizes={mediaImageSizes.cartItem}
                  src={artworkPlaceholderImage.src}
                />
              )}
            </Link>

            <div className="cart-item-body">
              <div className="cart-item-main">
                <span className="small-caps">{row.statusText}</span>
                <h2>
                  <Link href={`/shop/${row.item.productSlug}`} prefetch={false}>
                    {row.product?.titleKo ?? row.item.productSlug}
                  </Link>
                </h2>
                <p>
                  {productOptionLabel(row.productOption)} ·{" "}
                  {row.item.shippingMethod === "pickup" ? "방문수령" : "택배"}
                  {row.item.madeToOrder ? " · 추가 제작" : ""}
                </p>
              </div>

              <div className="cart-item-controls">
                <CommerceQuantityStepper
                  ariaLabel="장바구니 수량"
                  className="cart-quantity-stepper"
                  decreaseLabel="수량 줄이기"
                  increaseLabel="수량 늘리기"
                  inputLabel="수량"
                  max={row.maxQuantity}
                  onChange={(nextQuantity) =>
                    void updateQuantity(row.key, nextQuantity)
                  }
                  value={row.item.quantity}
                />
                <SiteActionButton
                  className="cart-remove-button"
                  onClick={() => void removeItem(row.key)}
                  variant="quiet"
                >
                  삭제
                </SiteActionButton>
              </div>

              <div className="cart-item-total">
                <strong>{row.amountLabel}</strong>
                {row.canCheckout ? (
                  <SiteActionLink href={row.checkoutHref}>
                    주문하기
                  </SiteActionLink>
                ) : (
                  <SiteActionButton disabled>
                    주문 불가
                  </SiteActionButton>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      <aside className="cart-summary" aria-label="장바구니 요약">
        <span className="small-caps">Cart Summary</span>
        <h2>담은 상품 {itemCount}개</h2>
        <CommerceSummaryList
          items={[
            {
              label: "상품 합계",
              value: formatCurrency(estimatedSubtotal),
            },
            {
              label: "무료배송 기준",
              value:
                freeShippingRemaining > 0
                  ? `${formatCurrency(freeShippingRemaining)} 남음`
                  : "무료배송 가능",
            },
            {
              label: "예상 결제 금액",
              value: formatCurrency(estimatedTotal),
            },
          ]}
        />
        <p>
          할인 전 상품금액 기준 {formatCurrency(ORDER_FREE_SHIPPING_THRESHOLD_KRW)}
          이상 무료배송됩니다. 택배 기본 배송비는 {formatCurrency(ORDER_SHIPPING_FEE_KRW)}
          입니다.
        </p>
        <p>
          무료배송 주문을 부분 반품하여 최종 구매금액이 무료배송 기준 미만이
          되는 경우 최초 배송비 {formatCurrency(ORDER_SHIPPING_FEE_KRW)}이
          환불금에서 차감될 수 있습니다.
        </p>
        {containsLivePlant ? (
          <p>식물 포함 상품은 수령 지연 또는 관리 상태에 따라 교환·반품이 제한될 수 있습니다.</p>
        ) : null}
        {containsMadeToOrder ? (
          <p>주문 제작 상품은 제작 착수 전 제작 내용, 견적, 예상 일정을 확인해 주세요.</p>
        ) : null}
        <SiteActionButton
          onClick={() => void removeAllItems()}
          variant="quiet"
        >
          장바구니 비우기
        </SiteActionButton>
      </aside>
    </div>
  );
}

function createCartRow({
  item,
  product,
}: {
  item: CartItem;
  product: ProductListItem | null;
}): CartRow {
  const productOption =
    item.productOption === "plant_included" && product?.plantOption.enabled
      ? "plant_included"
      : "plant_excluded";
  const availableQuantity = item.madeToOrder
    ? 99
    : product
      ? getProductPurchaseLimitQuantity(product)
      : 99;
  const maxQuantity = Math.max(1, availableQuantity);
  const quantity = Math.min(item.quantity, maxQuantity);
  const containsLivePlant =
    productOption === "plant_included" && Boolean(product?.plantOption.enabled);
  const unitPrice =
    product?.commerce.price === null || !product
      ? null
      : product.commerce.price +
        (containsLivePlant ? product.plantOption.priceDelta : 0);
  const amounts = calculateOrderAmounts({
    quantity,
    shippingMethod: item.shippingMethod,
    unitPrice,
  });
  const canCheckout = Boolean(
    product &&
      product.published &&
      !product.isArchived &&
      unitPrice !== null &&
      amounts.subtotalKrw !== null &&
      amounts.totalKrw !== null &&
      (item.madeToOrder
        ? product.madeToOrder.available
        : product.commerce.availabilityStatus === "available") &&
      quantity <= availableQuantity,
  );

  return {
    amountLabel:
      amounts.totalKrw === null ? "가격 확인 필요" : formatCurrency(amounts.totalKrw),
    canCheckout,
    checkoutHref: createCheckoutHref({ item, productOption, quantity }),
    image: product ? getProductCartImage(product) : null,
    item: {
      ...item,
      quantity,
    },
    key: getCartItemKey(item),
    maxQuantity,
    product,
    productOption,
    statusText: getCartStatusText({ canCheckout, item, product }),
    subtotal: amounts.subtotalKrw ?? 0,
    total: amounts.totalKrw ?? 0,
    unitPrice,
  };
}

function createCheckoutHref({
  item,
  productOption,
  quantity,
}: {
  item: CartItem;
  productOption: ProductOption;
  quantity: number;
}) {
  const params = new URLSearchParams({
    mode: "standard",
    option: productOption,
    product: item.productSlug,
    quantity: String(quantity),
    shipping: item.shippingMethod,
  });

  if (item.madeToOrder) {
    params.set("order", "made_to_order");
  }

  return `/checkout?${params.toString()}`;
}

function getCartStatusText({
  canCheckout,
  item,
  product,
}: {
  canCheckout: boolean;
  item: CartItem;
  product: ProductListItem | null;
}) {
  if (!product) {
    return "상품 확인 필요";
  }

  if (canCheckout) {
    return item.madeToOrder ? "추가 제작 주문" : "주문 가능";
  }

  if (product.commerce.availabilityStatus !== "available") {
    return "판매 상태 확인 필요";
  }

  return "주문 정보 확인 필요";
}

function productOptionLabel(option: ProductOption) {
  return option === "plant_included" ? "식물 포함" : "식물 제외";
}

function formatCurrency(value: number) {
  return `${new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0,
  }).format(value)}원`;
}
