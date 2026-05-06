import type {
  ConsepotProduct,
  ProductBadgeKind,
  ProductCta,
  ProductCtaKind,
  ProductImage,
} from "./product-model";
import { pickVariantSource } from "@/lib/media/media-variant-policy";

type ProductActionHref = {
  external: boolean;
  href: string | null;
};

export type ProductPurchaseKind =
  | "cafe24_cart"
  | "cafe24_checkout"
  | "cafe24_product";

export type Cafe24CartAction = {
  apiBaseUrl: string;
  apiVersion: string;
  basketType: "A0000" | "A0001";
  checkoutHref: string;
  clientId: string;
  duplicatedItemCheck: "F" | "T";
  frontApiKey: string;
  maxQuantity: number;
  prepaidShippingFee: "C" | "P";
  productNo: string;
  shopNo: number;
  variantCode: string;
};

export {
  appendProductSyncLog,
  createProductDraft,
  deleteProduct,
  deleteProductImageAssets,
  getProductById,
  getProductBySlug,
  getProductSlugs,
  getPublishedProducts,
  normalizeSlug,
  productImageBucket,
  readProductSyncLogs,
  readProducts,
  updateProduct,
  updateProductCafe24Mapping,
  updateProductInventory,
  writeProducts,
  type ProductDraftInput,
  type ProductInventoryUpdateInput,
  type ProductSyncLogInput,
  type ProductUpdateInput,
} from "./product-store";

export function getProductPrimaryImage(product: ConsepotProduct) {
  const image =
    product.images.find((image) => image.isPrimary && image.src) ??
    product.images.find((image) => image.src) ??
    product.images.find((image) => image.isPrimary) ??
    product.images[0] ??
    null;

  return image ? withProductImageVariant(image, "detail") : null;
}

export function getProductListImage(product: ConsepotProduct) {
  const image =
    product.images.find((image) => image.isListImage && image.src) ??
    product.images.find((image) => image.isListImage) ??
    getProductPrimaryImage(product);

  return image ? withProductImageVariant(image, "list") : null;
}

export function getProductDisplayImages(product: ConsepotProduct) {
  return product.images
    .filter(
      (image) =>
        Boolean(image.src || pickVariantSource(image.variants, "detail")) &&
        (image.isDetail || image.isPrimary),
    )
    .map((image) => withProductImageVariant(image, "detail"));
}

export function getProductThumbnailImage(image: ProductImage) {
  return withProductImageVariant(image, "thumbnail");
}

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

function withProductImageVariant(
  image: ProductImage,
  surface: "detail" | "list" | "master" | "thumbnail",
) {
  const variant = pickVariantSource(image.variants, surface);

  if (!variant) {
    return image;
  }

  return {
    ...image,
    height: variant.height,
    src: variant.src,
    storagePath: variant.storagePath ?? image.storagePath,
    width: variant.width,
  };
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
    const href = getProductPurchaseHref(product);

    return {
      external: href ? isExternalHref(href) : false,
      href,
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
  return (
    getCafe24DirectCheckoutHref(product) ??
    getCafe24ProductHref(product) ??
    getCafe24CartAction(product)?.checkoutHref ??
    null
  );
}

export function getProductPurchaseKind(
  product: ConsepotProduct,
): ProductPurchaseKind | null {
  if (getCafe24DirectCheckoutHref(product)) {
    return "cafe24_checkout";
  }

  if (getCafe24ProductHref(product)) {
    return "cafe24_product";
  }

  if (getCafe24CartAction(product)) {
    return "cafe24_cart";
  }

  return null;
}

export function getCafe24DirectCheckoutHref(product: ConsepotProduct) {
  const checkoutUrl = product.cafe24.checkoutUrl?.trim();

  if (checkoutUrl) {
    return resolveExternalHref(
      checkoutUrl,
      process.env.NEXT_PUBLIC_CAFE24_SHOP_BASE_URL ||
        buildDefaultCafe24ShopBaseUrl(),
    );
  }

  const productNo = product.cafe24.productNo?.trim();
  const shopBaseUrl =
    process.env.NEXT_PUBLIC_CAFE24_SHOP_BASE_URL ||
    buildDefaultCafe24ShopBaseUrl();

  if (!productNo || !shopBaseUrl) {
    return null;
  }

  return resolveExternalHref(
    `/surl/O/${encodeURIComponent(productNo)}`,
    shopBaseUrl,
  );
}

export function getCafe24ProductHref(product: ConsepotProduct) {
  const productUrl = product.cafe24.productUrl?.trim();

  if (!productUrl) {
    return null;
  }

  return resolveExternalHref(
    productUrl,
    process.env.NEXT_PUBLIC_CAFE24_SHOP_BASE_URL ||
      buildDefaultCafe24ShopBaseUrl(),
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

export function getCafe24CartAction(
  product: ConsepotProduct,
): Cafe24CartAction | null {
  const productNo = product.cafe24.productNo;
  const variantCode = product.cafe24.variantCode;
  const mallId =
    process.env.NEXT_PUBLIC_CAFE24_MALL_ID || process.env.CAFE24_MALL_ID;
  const clientId =
    process.env.NEXT_PUBLIC_CAFE24_CLIENT_ID || process.env.CAFE24_CLIENT_ID;

  if (
    product.commerce.availabilityStatus !== "available" ||
    !productNo ||
    !variantCode ||
    !mallId ||
    !clientId
  ) {
    return null;
  }

  return {
    apiBaseUrl: `https://${mallId}.cafe24api.com/api/v2`,
    apiVersion:
      process.env.NEXT_PUBLIC_CAFE24_API_VERSION ||
      process.env.CAFE24_API_VERSION ||
      "2026-03-01",
    basketType: "A0000",
    checkoutHref: getCafe24CheckoutHref(product),
    clientId,
    duplicatedItemCheck: "T",
    frontApiKey: process.env.NEXT_PUBLIC_CAFE24_FRONT_API_KEY || "",
    maxQuantity: getPurchaseMaxQuantity(product),
    prepaidShippingFee: "P",
    productNo,
    shopNo: Number(
      process.env.NEXT_PUBLIC_CAFE24_SHOP_NO ||
        process.env.CAFE24_SHOP_NO ||
        "1",
    ),
    variantCode,
  };
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

function isExternalHref(href: string) {
  return /^https?:\/\//.test(href);
}

function buildDefaultCafe24ShopBaseUrl() {
  const mallId =
    process.env.NEXT_PUBLIC_CAFE24_MALL_ID || process.env.CAFE24_MALL_ID;
  return mallId ? `https://${mallId}.cafe24.com` : undefined;
}

function getPurchaseMaxQuantity(product: ConsepotProduct) {
  const stockQuantity = product.commerce.stockQuantity;

  if (stockQuantity && stockQuantity > 0) {
    return stockQuantity;
  }

  return 99;
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
