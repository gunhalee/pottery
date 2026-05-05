import type {
  ConsepotProduct,
  ProductBadgeKind,
  ProductCta,
  ProductCtaKind,
} from "./product-model";

type ProductActionHref = {
  external: boolean;
  href: string | null;
};

export {
  appendProductSyncLog,
  createProductDraft,
  deleteProduct,
  getProductById,
  getProductBySlug,
  getProductSlugs,
  getPublishedProducts,
  normalizeSlug,
  readProductSyncLogs,
  readProducts,
  updateProduct,
  updateProductCafe24Mapping,
  writeProducts,
  type ProductDraftInput,
  type ProductSyncLogInput,
  type ProductUpdateInput,
} from "./product-store";

export function getProductBadges(product: ConsepotProduct) {
  const badges: ProductBadgeKind[] = [];

  badges.push(product.commerce.availabilityStatus);

  if (product.isLimited) {
    badges.push("limited");
  }

  if (product.kind === "one_of_a_kind") {
    badges.push("one_of_a_kind");
  }

  return badges;
}

export function getProductCta(product: ConsepotProduct): ProductCta {
  if (product.commerce.availabilityStatus === "available") {
    const purchaseHref = getProductPurchaseHref(product);

    return {
      kind: "buy",
      label: purchaseHref ? "구매하기" : "Cafe24 구매 준비 중",
    };
  }

  if (product.commerce.availabilityStatus === "upcoming") {
    return {
      kind: "coming_soon",
      label: "입고 소식 받기",
    };
  }

  if (product.commerce.availabilityStatus === "archive") {
    return {
      kind: "archive",
      label: "아카이브 작품 보기",
    };
  }

  const ctaByType: Record<
    Exclude<ProductCtaKind, "buy" | "coming_soon" | "archive">,
    string
  > = {
    next_limited_alert: "다음 한정 소식 받기",
    restock_alert: "재입고 알림 받기",
    similar_work_alert: "비슷한 작품 알림 받기",
  };

  const ctaKind = product.restockCtaType ?? "similar_work_alert";

  return {
    kind: ctaKind,
    label: ctaByType[ctaKind],
  };
}

export function getProductActionHref(
  product: ConsepotProduct,
): ProductActionHref {
  if (product.commerce.availabilityStatus === "available") {
    return {
      external: false,
      href: getProductPurchaseHref(product),
    };
  }

  if (
    product.commerce.availabilityStatus === "sold_out" ||
    product.commerce.availabilityStatus === "upcoming"
  ) {
    return {
      external: true,
      href: getKakaoProductHref(product),
    };
  }

  return {
    external: false,
    href: `/shop/${product.slug}`,
  };
}

export function getProductPurchaseHref(product: ConsepotProduct) {
  if (!product.cafe24.productNo || !product.cafe24.variantCode) {
    return null;
  }

  return `/checkout/cafe24/${product.slug}`;
}

export function getCafe24ProductHref(product: ConsepotProduct) {
  if (!product.cafe24.productUrl) {
    return null;
  }

  return resolveExternalHref(
    product.cafe24.productUrl,
    process.env.NEXT_PUBLIC_CAFE24_SHOP_BASE_URL,
  );
}

export function getCafe24CheckoutHref(product: ConsepotProduct) {
  const href =
    product.cafe24.checkoutUrl ||
    process.env.NEXT_PUBLIC_CAFE24_CHECKOUT_BASE_URL;

  if (href) {
    return resolveExternalHref(
      href,
      process.env.NEXT_PUBLIC_CAFE24_SHOP_BASE_URL,
    );
  }

  return resolveExternalHref(
    "/order/basket.html",
    process.env.NEXT_PUBLIC_CAFE24_SHOP_BASE_URL ||
      buildDefaultCafe24ShopBaseUrl(),
  );
}

export function getKakaoProductHref(product: ConsepotProduct) {
  const baseHref =
    process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL || "https://pf.kakao.com/";
  const href = new URL(baseHref);
  const source =
    product.commerce.availabilityStatus === "upcoming"
      ? "product_upcoming"
      : product.restockCtaType ?? "product_soldout";

  href.searchParams.set("source", source);
  href.searchParams.set("product", product.slug);

  return href.toString();
}

export function formatProductPrice(product: ConsepotProduct) {
  if (product.commerce.price === null) {
    return "가격 입력 예정";
  }

  return new Intl.NumberFormat("ko-KR", {
    currency: product.commerce.currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(product.commerce.price);
}

export function getMappedCafe24ProductNos(products: ConsepotProduct[]) {
  return products
    .map((product) => product.cafe24.productNo)
    .filter((productNo): productNo is string => Boolean(productNo));
}

function resolveExternalHref(href: string, baseHref?: string) {
  if (/^https?:\/\//.test(href)) {
    return href;
  }

  if (!baseHref) {
    return href;
  }

  return new URL(href, baseHref).toString();
}

function buildDefaultCafe24ShopBaseUrl() {
  const mallId =
    process.env.NEXT_PUBLIC_CAFE24_MALL_ID || process.env.CAFE24_MALL_ID;
  return mallId ? `https://${mallId}.cafe24.com` : undefined;
}

export type {
  AvailabilityStatus,
  Cafe24ProductMapping,
  Cafe24MappingStatus,
  ConsepotProduct,
  LimitedType,
  ProductBadgeKind,
  ProductCategory,
  ProductCommerceSnapshot,
  ProductContent,
  ProductCta,
  ProductCtaKind,
  ProductImage,
  ProductKind,
  ProductSyncLog,
  ProductSyncLogStatus,
  RestockCtaType,
} from "./product-model";
