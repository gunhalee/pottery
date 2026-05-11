import type { MediaVariantSourceMap } from "@/lib/media/media-model";

export type ProductKind = "regular" | "one_of_a_kind";

export type AvailabilityStatus =
  | "available"
  | "sold_out"
  | "upcoming"
  | "archive";

export type LimitedType =
  | "quantity"
  | "period"
  | "kiln_batch"
  | "project"
  | null;

export type RestockCtaType =
  | "restock_alert"
  | "similar_work_alert"
  | "next_limited_alert"
  | null;

export type ProductCategory =
  | "cup"
  | "plate"
  | "object"
  | "gift"
  | "limited"
  | "archive"
  | (string & {});

export type ProductBadgeKind =
  | "available"
  | "sold_out"
  | "upcoming"
  | "archive"
  | "limited"
  | "one_of_a_kind";

export type ProductCtaKind =
  | "buy"
  | "made_to_order"
  | "restock_alert"
  | "similar_work_alert"
  | "next_limited_alert"
  | "coming_soon"
  | "archive";

export type ProductImage = {
  alt: string;
  caption?: string;
  height?: number;
  id?: string;
  isDescription?: boolean;
  isDetail?: boolean;
  isListImage?: boolean;
  isPrimary?: boolean;
  placeholderLabel?: string;
  src?: string;
  storagePath?: string;
  variants?: MediaVariantSourceMap;
  width?: number;
};

export type ProductCommerceSnapshot = {
  availabilityStatus: AvailabilityStatus;
  currency: "KRW";
  price: number | null;
  source: "internal";
  stockQuantity: number | null;
  syncedAt?: string;
};

export type ProductPlantOption = {
  careNotice?: string;
  enabled: boolean;
  priceDelta: number;
  returnNotice?: string;
  shippingRestrictionNotice?: string;
  species?: string;
};

export type ProductMadeToOrder = {
  available: boolean;
  daysMax: number;
  daysMin: number;
  notice?: string;
};

export type ProductContent = {
  careNote?: string;
  category: ProductCategory;
  commerce: ProductCommerceSnapshot;
  createdAt: string;
  glaze?: string;
  id: string;
  images: ProductImage[];
  isArchived: boolean;
  isLimited: boolean;
  kind: ProductKind;
  limitedType: LimitedType;
  material?: string;
  madeToOrder: ProductMadeToOrder;
  plantOption: ProductPlantOption;
  published: boolean;
  publishedAt?: string;
  restockCtaType: RestockCtaType;
  shippingNote?: string;
  shortDescription: string;
  size?: string;
  slug: string;
  story?: string;
  storyBody?: unknown;
  storyText?: string;
  titleKo: string;
  updatedAt: string;
  usageNote?: string;
};
export type ConsepotProduct = ProductContent;

export type ProductListItem = Pick<
  ProductContent,
  | "category"
  | "commerce"
  | "createdAt"
  | "id"
  | "images"
  | "isArchived"
  | "isLimited"
  | "kind"
  | "limitedType"
  | "madeToOrder"
  | "plantOption"
  | "published"
  | "publishedAt"
  | "restockCtaType"
  | "shortDescription"
  | "slug"
  | "titleKo"
  | "updatedAt"
>;

export type ProductCta = {
  kind: ProductCtaKind;
  label: string;
};
