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
  | "restock_alert"
  | "similar_work_alert"
  | "next_limited_alert"
  | "coming_soon"
  | "archive";

export type Cafe24MappingStatus =
  | "pending"
  | "mapped"
  | "sync_failed"
  | "not_applicable";

export type ProductImage = {
  alt: string;
  cafe24ImagePath?: string;
  isPrimary?: boolean;
  placeholderLabel?: string;
  src?: string;
};

export type ProductCommerceSnapshot = {
  availabilityStatus: AvailabilityStatus;
  currency: "KRW";
  price: number | null;
  source: "cafe24";
  stockQuantity: number | null;
  syncedAt?: string;
};

export type Cafe24ProductMapping = {
  categoryNo?: number;
  checkoutUrl?: string;
  displayGroup?: number;
  lastSyncError?: string;
  lastSyncedAt?: string;
  mappingStatus: Cafe24MappingStatus;
  productNo: string | null;
  productUrl?: string;
  variantCode?: string;
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
  published: boolean;
  publishedAt?: string;
  restockCtaType: RestockCtaType;
  shippingNote?: string;
  shortDescription: string;
  size?: string;
  slug: string;
  story?: string;
  titleKo: string;
  updatedAt: string;
  usageNote?: string;
};

export type ConsepotProduct = ProductContent & {
  cafe24: Cafe24ProductMapping;
};

export type ProductCta = {
  kind: ProductCtaKind;
  label: string;
};
