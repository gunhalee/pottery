"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

export type RecentProductSummary = {
  href: string;
  imageAlt: string;
  imageSrc: string | null;
  price: string;
  slug: string;
  title: string;
};

type StoredRecentProduct = RecentProductSummary & {
  viewedAt: number;
};

type StoredCartReturn = {
  cartHref: string;
  productHref: string;
  productName: string;
  savedAt: number;
};

const recentProductsKey = "consepot_recent_products";
const recentCartKey = "consepot_recent_cart";
const cartReturnMaxAge = 1000 * 60 * 60 * 24 * 7;

export function ProductVisitTracker({
  product,
}: {
  product: RecentProductSummary;
}) {
  useEffect(() => {
    try {
      const items = readRecentProducts()
        .filter((item) => item.slug !== product.slug)
        .slice(0, 7);
      window.localStorage.setItem(
        recentProductsKey,
        JSON.stringify([{ ...product, viewedAt: Date.now() }, ...items]),
      );
    } catch {
      // localStorage can be unavailable in private browsing modes.
    }
  }, [product]);

  return null;
}

export function RecentProductsPanel({
  currentSlug,
  products,
  title = "최근 본 작품",
}: {
  currentSlug?: string;
  products: RecentProductSummary[];
  title?: string;
}) {
  const [recentProducts, setRecentProducts] = useState<StoredRecentProduct[]>([]);
  const productMap = useMemo(
    () => new Map(products.map((product) => [product.slug, product])),
    [products],
  );

  useEffect(() => {
    const items = readRecentProducts()
      .filter((item) => item.slug !== currentSlug)
      .map((item) => {
        const current = productMap.get(item.slug);
        return current ? { ...current, viewedAt: item.viewedAt } : null;
      })
      .filter((item): item is StoredRecentProduct => Boolean(item))
      .slice(0, 4);
    window.setTimeout(() => setRecentProducts(items), 0);
  }, [currentSlug, productMap]);

  if (recentProducts.length === 0) {
    return null;
  }

  return (
    <section className="recent-products-panel" aria-label={title}>
      <div className="recent-products-head">
        <h2>{title}</h2>
      </div>
      <div className="recent-products-list">
        {recentProducts.map((product) => (
          <a className="recent-product-card" href={product.href} key={product.slug}>
            <span className="recent-product-image" aria-hidden={!product.imageSrc}>
              {product.imageSrc ? (
                <Image
                  alt={product.imageAlt}
                  fill
                  sizes="(max-width: 640px) 100vw, 220px"
                  src={product.imageSrc}
                />
              ) : null}
            </span>
            <strong>{product.title}</strong>
            <em>{product.price}</em>
          </a>
        ))}
      </div>
    </section>
  );
}

export function CartReturnNotice() {
  const [cartReturn, setCartReturn] = useState<StoredCartReturn | null>(null);

  useEffect(() => {
    try {
      const item = readCartReturn();

      if (!item || Date.now() - item.savedAt > cartReturnMaxAge) {
        window.localStorage.removeItem(recentCartKey);
        return;
      }

      window.setTimeout(() => setCartReturn(item), 0);
    } catch {
      window.setTimeout(() => setCartReturn(null), 0);
    }
  }, []);

  if (!cartReturn) {
    return null;
  }

  return (
    <aside className="cart-return-notice" aria-label="Cafe24 장바구니 복귀">
      <div>
        <span>최근 장바구니</span>
        <strong>{cartReturn.productName}</strong>
      </div>
      <a href={cartReturn.cartHref}>장바구니로 돌아가기</a>
      <button
        aria-label="장바구니 복귀 알림 닫기"
        onClick={() => {
          window.localStorage.removeItem(recentCartKey);
          setCartReturn(null);
        }}
        type="button"
      >
        닫기
      </button>
    </aside>
  );
}

function readRecentProducts() {
  return parseArray<StoredRecentProduct>(
    window.localStorage.getItem(recentProductsKey),
  ).filter(isStoredRecentProduct);
}

function readCartReturn() {
  const value = window.localStorage.getItem(recentCartKey);

  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return isStoredCartReturn(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseArray<T>(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function isStoredRecentProduct(value: unknown): value is StoredRecentProduct {
  return (
    typeof value === "object" &&
    value !== null &&
    "slug" in value &&
    "viewedAt" in value &&
    typeof value.viewedAt === "number"
  );
}

function isStoredCartReturn(value: unknown): value is StoredCartReturn {
  return (
    typeof value === "object" &&
    value !== null &&
    "cartHref" in value &&
    "productName" in value &&
    "savedAt" in value &&
    typeof value.cartHref === "string" &&
    typeof value.productName === "string" &&
    typeof value.savedAt === "number"
  );
}
