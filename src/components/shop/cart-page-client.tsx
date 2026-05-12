"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArtworkImage } from "@/components/media/artwork-image";
import type { ProductOption } from "@/lib/orders/order-model";
import { calculateOrderAmounts } from "@/lib/orders/pricing";
import {
  cartChangedEventName,
  cartStorageKey,
  clearCart,
  getCartItemCount,
  getCartItemKey,
  readCartSnapshot,
  removeCartItem,
  updateCartItemQuantity,
  type CartItem,
  type CartSnapshot,
} from "@/lib/shop/cart-storage";
import type { ProductImage, ProductListItem } from "@/lib/shop/product-model";

type CartPageClientProps = {
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

export function CartPageClient({ products }: CartPageClientProps) {
  const [hasHydrated, setHasHydrated] = useState(false);
  const [snapshot, setSnapshot] = useState<CartSnapshot>(emptySnapshot);
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

  useEffect(() => {
    function syncCart() {
      setSnapshot(readCartSnapshot());
      setHasHydrated(true);
    }

    function syncCartFromStorage(event: StorageEvent) {
      if (event.key === cartStorageKey) {
        syncCart();
      }
    }

    syncCart();
    window.addEventListener(cartChangedEventName, syncCart);
    window.addEventListener("storage", syncCartFromStorage);

    return () => {
      window.removeEventListener(cartChangedEventName, syncCart);
      window.removeEventListener("storage", syncCartFromStorage);
    };
  }, []);

  function updateQuantity(key: string, quantity: number) {
    const row = rows.find((item) => item.key === key);

    updateCartItemQuantity(key, quantity, row?.maxQuantity ?? 99);
    setSnapshot(readCartSnapshot());
  }

  function removeItem(key: string) {
    removeCartItem(key);
    setSnapshot(readCartSnapshot());
  }

  function removeAllItems() {
    clearCart();
    setSnapshot(readCartSnapshot());
  }

  if (!hasHydrated) {
    return (
      <div className="shop-subpage-empty">
        <strong>장바구니를 확인하고 있습니다.</strong>
        <p>브라우저에 저장된 상품을 불러오는 중입니다.</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="shop-subpage-empty">
        <strong>장바구니가 비어 있습니다.</strong>
        <p>소장하고 싶은 작업물을 장바구니에 담아 보세요.</p>
        <Link className="button-primary" href="/shop" prefetch={false}>
          소장하기로 이동
        </Link>
      </div>
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
                  sizes="(max-width: 720px) 96px, 132px"
                  src={row.image.src}
                />
              ) : (
                <ArtworkImage
                  alt="상품 이미지 준비 중"
                  className="cart-item-image"
                  fill
                  loading="lazy"
                  sizes="(max-width: 720px) 96px, 132px"
                  src="/asset/hero-image.jpg"
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
                <div
                  className="cart-quantity-stepper"
                  role="group"
                  aria-label="장바구니 수량"
                >
                  <button
                    aria-label="수량 줄이기"
                    disabled={row.item.quantity <= 1}
                    onClick={() => updateQuantity(row.key, row.item.quantity - 1)}
                    type="button"
                  >
                    -
                  </button>
                  <input
                    aria-label="수량"
                    inputMode="numeric"
                    max={row.maxQuantity}
                    min={1}
                    onChange={(event) =>
                      updateQuantity(row.key, Number(event.target.value))
                    }
                    type="number"
                    value={row.item.quantity}
                  />
                  <button
                    aria-label="수량 늘리기"
                    disabled={row.item.quantity >= row.maxQuantity}
                    onClick={() => updateQuantity(row.key, row.item.quantity + 1)}
                    type="button"
                  >
                    +
                  </button>
                </div>
                <button
                  className="button-quiet cart-remove-button"
                  onClick={() => removeItem(row.key)}
                  type="button"
                >
                  삭제
                </button>
              </div>

              <div className="cart-item-total">
                <strong>{row.amountLabel}</strong>
                {row.canCheckout ? (
                  <Link
                    className="button-primary"
                    href={row.checkoutHref}
                    prefetch={false}
                  >
                    주문하기
                  </Link>
                ) : (
                  <button className="button-primary" disabled type="button">
                    주문 불가
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      <aside className="cart-summary" aria-label="장바구니 요약">
        <span className="small-caps">Cart Summary</span>
        <h2>담은 상품 {itemCount}개</h2>
        <dl>
          <div>
            <dt>상품 합계</dt>
            <dd>{formatCurrency(estimatedSubtotal)}</dd>
          </div>
          <div>
            <dt>예상 결제 금액</dt>
            <dd>{formatCurrency(estimatedTotal)}</dd>
          </div>
        </dl>
        <p>
          현재 주문 화면은 상품별로 진입합니다. 장바구니는 이 브라우저에만
          저장됩니다.
        </p>
        <button className="button-quiet" onClick={removeAllItems} type="button">
          장바구니 비우기
        </button>
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
    : (product?.commerce.stockQuantity ?? 99);
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
    image: product ? getCartImage(product) : null,
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

function getCartImage(product: ProductListItem) {
  return (
    product.images.find((image) => image.isListImage && image.src) ??
    product.images.find((image) => image.isPrimary && image.src) ??
    product.images.find((image) => image.src) ??
    null
  );
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
