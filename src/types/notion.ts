export const publishStatuses = ["draft", "published"] as const;
export type PublishStatus = (typeof publishStatuses)[number];

export const postTags = ["작업일지", "일정", "비하인드", "신제품"] as const;
export type PostTag = (typeof postTags)[number];

export const classTypes = ["oneday", "regular", "group"] as const;
export type ClassType = (typeof classTypes)[number];

export const productCategories = [
  "basic",
  "mid",
  "premium",
  "set",
  "custom",
] as const;
export type ProductCategory = (typeof productCategories)[number];

export const inventoryStatuses = ["on_sale", "limited", "sold_out"] as const;
export type InventoryStatus = (typeof inventoryStatuses)[number];

export type ReviewTargetType = "class" | "product";

export type PageMeta = {
  pageId: string;
  pageUrl: string;
  createdTime: string;
  lastEditedTime: string;
};

export type NotionPost = PageMeta & {
  title: string;
  slug: string;
  excerpt: string;
  coverImageUrl: string | null;
  tags: PostTag[];
  publishedAt: string | null;
  status: PublishStatus;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type NotionClass = PageMeta & {
  title: string;
  slug: string;
  type: ClassType;
  summary: string;
  description: string;
  durationMinutes: number | null;
  basePrice: number | null;
  capacityDefault: number | null;
  thumbnailUrl: string | null;
  naverReservationUrl: string | null;
  status: PublishStatus;
};

export type NotionProduct = PageMeta & {
  title: string;
  slug: string;
  category: ProductCategory;
  priceLabel: string;
  summary: string;
  description: string;
  inventoryStatus: InventoryStatus;
  purchaseUrl: string | null;
  isPremium: boolean;
  isCustom: boolean;
  thumbnailUrl: string | null;
  status: PublishStatus;
};

export type NotionReview = PageMeta & {
  authorAlias: string;
  targetType: ReviewTargetType;
  targetSlug: string;
  rating: number | null;
  body: string;
  approved: boolean;
  createdAt: string | null;
};

export type NotionSiteSettings = PageMeta & {
  siteName: string;
  brandSlogan: string;
  address: string;
  parkingInfo: string;
  businessHours: string;
  kakaoChannelUrl: string;
  instagramUrl: string | null;
  smartstoreUrl: string | null;
  seoDefaultTitle: string | null;
  seoDefaultDescription: string | null;
};
