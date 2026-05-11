import { pickVariantSource } from "@/lib/media/media-variant-policy";
import type {
  ConsepotProduct,
  ProductBadgeKind,
  ProductCta,
  ProductCtaKind,
  ProductImage,
  ProductListItem,
} from "./product-model";

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

export {
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
  readProducts,
  updateProduct,
  updateProductInventory,
  writeProducts,
  type ProductDraftInput,
  type ProductInventoryUpdateInput,
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
    return {
      kind: "buy",
      label: "구매하기",
    };
  }

  if (
    product.commerce.availabilityStatus === "sold_out" &&
    product.madeToOrder.available &&
    product.commerce.price !== null
  ) {
    return {
      kind: "made_to_order",
      label: "추가 제작 주문",
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
      label: "작업물 보기",
    };
  }

  const ctaByType: Record<
    Exclude<ProductCtaKind, "buy" | "made_to_order" | "coming_soon" | "archive">,
    string
  > = {
    next_limited_alert: "다음 한정 소식 받기",
    restock_alert: "재입고 알림 받기",
    similar_work_alert: "비슷한 작업물 문의",
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
  if (
    product.commerce.availabilityStatus === "available" ||
    (product.commerce.availabilityStatus === "sold_out" &&
      product.madeToOrder.available &&
      product.commerce.price !== null)
  ) {
    return {
      external: false,
      href: `/shop/${product.slug}`,
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
  return product.commerce.availabilityStatus === "available" ||
    (product.commerce.availabilityStatus === "sold_out" &&
      product.madeToOrder.available &&
      product.commerce.price !== null)
    ? `/shop/${product.slug}`
    : null;
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

export type {
  AvailabilityStatus,
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
  RestockCtaType,
} from "./product-model";
