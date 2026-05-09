import type {
  ConsepotProduct,
  ProductBadgeKind,
  ProductCta,
  ProductCtaKind,
  ProductImage,
  ProductListItem,
} from "./product-model";
import { pickVariantSource } from "@/lib/media/media-variant-policy";

type ProductActionHref = {
  external: boolean;
  href: string | null;
};

type ProductImageSource = Pick<ProductListItem, "images">;
type ProductBadgeSource = Pick<
  ProductListItem,
  "commerce" | "isLimited" | "kind"
>;
type ProductPriceSource = Pick<ProductListItem, "commerce">;

export type ProductPurchaseKind =
  | "cafe24_cart"
  | "cafe24_checkout"
  | "cafe24_product";

export type Cafe24CartAction = {
  basketType: "A0000" | "A0001";
  cartEndpoint: string;
  checkoutHref: string;
  displayGroup: number;
  maxQuantity: number;
  prepaidShippingFee: "C" | "P";
  productCategoryNo: number;
  productName: string;
  productNo: string;
  productPrice: number;
  statusEndpoint: string;
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
  getPublishedProductListItems,
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

export function getProductPrimaryImage(product: ProductImageSource) {
  const image =
    product.images.find((image) => image.isPrimary && image.src) ??
    product.images.find((image) => image.src) ??
    product.images.find((image) => image.isPrimary) ??
    product.images[0] ??
    null;

  return image ? withProductImageVariant(image, "detail") : null;
}

export function getProductListImage(product: ProductImageSource) {
  const image =
    product.images.find((image) => image.isListImage && image.src) ??
    product.images.find((image) => image.isListImage) ??
    getProductPrimaryImage(product);

  return image ? withProductImageVariant(image, "list") : null;
}

export function getProductDisplayImages(product: ProductImageSource) {
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

export function getProductBadges(product: ProductBadgeSource) {
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
      label: "아카이브 작업물 보기",
    };
  }

  const ctaByType: Record<
    Exclude<ProductCtaKind, "buy" | "coming_soon" | "archive">,
    string
  > = {
    next_limited_alert: "다음 한정 소식 받기",
    restock_alert: "재입고 알림 받기",
    similar_work_alert: "비슷한 작업물 알림 받기",
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
    getCafe24CartAction(product)?.checkoutHref ??
    getCafe24DirectCheckoutHref(product) ??
    getCafe24ProductHref(product) ??
    null
  );
}

export function getProductPurchaseKind(
  product: ConsepotProduct,
): ProductPurchaseKind | null {
  if (getCafe24CartAction(product)) {
    return "cafe24_cart";
  }

  if (getCafe24DirectCheckoutHref(product)) {
    return "cafe24_checkout";
  }

  if (getCafe24ProductHref(product)) {
    return "cafe24_product";
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

export function getCafe24BasketHref() {
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
  const productCategoryNo =
    product.cafe24.categoryNo ?? getDefaultCafe24CategoryNo();
  const shopBaseUrl =
    process.env.NEXT_PUBLIC_CAFE24_SHOP_BASE_URL ||
    buildDefaultCafe24ShopBaseUrl();
  const productPrice = product.commerce.price;

  if (
    product.commerce.availabilityStatus !== "available" ||
    !productNo ||
    !variantCode ||
    !productCategoryNo ||
    !shopBaseUrl ||
    productPrice === null
  ) {
    return null;
  }

  return {
    basketType: "A0000",
    cartEndpoint: resolveExternalHref("/exec/front/order/basket/", shopBaseUrl),
    checkoutHref: getCafe24BasketHref(),
    displayGroup:
      product.cafe24.displayGroup ?? getDefaultCafe24DisplayGroup(),
    maxQuantity: getPurchaseMaxQuantity(product),
    prepaidShippingFee: "P",
    productCategoryNo,
    productName: product.titleKo,
    productNo,
    productPrice,
    statusEndpoint: `/api/cafe24/product-status?slug=${encodeURIComponent(
      product.slug,
    )}`,
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

export function formatProductPrice(product: ProductPriceSource) {
  if (product.commerce.price === null) {
    return "가격 입력 예정";
  }

  return `${new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0,
  }).format(product.commerce.price)}원`;
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

function getDefaultCafe24CategoryNo() {
  const value =
    process.env.NEXT_PUBLIC_CAFE24_DEFAULT_CATEGORY_NO ||
    process.env.CAFE24_DEFAULT_CATEGORY_NO;
  const categoryNo = value ? Number(value) : null;
  return categoryNo && Number.isFinite(categoryNo) ? categoryNo : null;
}

function getDefaultCafe24DisplayGroup() {
  const value =
    process.env.NEXT_PUBLIC_CAFE24_DEFAULT_DISPLAY_GROUP ||
    process.env.CAFE24_DEFAULT_DISPLAY_GROUP;
  const displayGroup = value ? Number(value) : null;
  return displayGroup && Number.isFinite(displayGroup) ? displayGroup : 1;
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
  ProductListItem,
  ProductSyncLog,
  ProductSyncLogStatus,
  RestockCtaType,
} from "./product-model";
