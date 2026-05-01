import type { QueryDataSourceParameters } from "@notionhq/client";

export const NOTION_API_VERSION = "2026-03-11";

export const notionDataSources = {
  posts: {
    name: "Posts",
    properties: {
      title: "title",
      slug: "slug",
      excerpt: "excerpt",
      coverImage: "cover_image",
      tags: "tags",
      publishedAt: "published_at",
      status: "status",
      seoTitle: "seo_title",
      seoDescription: "seo_description",
    },
  },
  classes: {
    name: "Classes",
    properties: {
      title: "title",
      slug: "slug",
      type: "type",
      summary: "summary",
      description: "description",
      durationMinutes: "duration_minutes",
      basePrice: "base_price",
      capacityDefault: "capacity_default",
      thumbnail: "thumbnail",
      naverReservationUrl: "naver_reservation_url",
      status: "status",
    },
  },
  products: {
    name: "Products",
    properties: {
      title: "title",
      slug: "slug",
      category: "category",
      priceLabel: "price_label",
      summary: "summary",
      description: "description",
      inventoryStatus: "inventory_status",
      purchaseUrl: "purchase_url",
      isPremium: "is_premium",
      isCustom: "is_custom",
      thumbnail: "thumbnail",
      status: "status",
    },
  },
  reviews: {
    name: "Reviews",
    properties: {
      authorAlias: "author_alias",
      targetType: "target_type",
      targetSlug: "target_slug",
      rating: "rating",
      body: "body",
      approved: "approved",
      createdAt: "created_at",
    },
  },
  siteSettings: {
    name: "SiteSettings",
    properties: {
      siteName: "site_name",
      brandSlogan: "brand_slogan",
      address: "address",
      parkingInfo: "parking_info",
      businessHours: "business_hours",
      kakaoChannelUrl: "kakao_channel_url",
      instagramUrl: "instagram_url",
      smartstoreUrl: "smartstore_url",
      seoDefaultTitle: "seo_default_title",
      seoDefaultDescription: "seo_default_description",
    },
  },
} as const;

export const notionCacheTags = {
  posts: "notion:posts",
  classes: "notion:classes",
  products: "notion:products",
  reviews: "notion:reviews",
  siteSettings: "notion:site-settings",
} as const;

export function createPublishedFilter(
  propertyName: string,
) {
  return {
    property: propertyName,
    select: {
      equals: "published",
    },
  };
}

export function createApprovedFilter(
  propertyName: string,
) {
  return {
    property: propertyName,
    checkbox: {
      equals: true,
    },
  };
}

export function getPostsSorts(): QueryDataSourceParameters["sorts"] {
  return [
    {
      property: notionDataSources.posts.properties.publishedAt,
      direction: "descending",
    },
  ];
}

export function getReviewsSorts(): QueryDataSourceParameters["sorts"] {
  return [
    {
      property: notionDataSources.reviews.properties.createdAt,
      direction: "descending",
    },
  ];
}

export function getLastEditedSorts(): QueryDataSourceParameters["sorts"] {
  return [
    {
      timestamp: "last_edited_time",
      direction: "descending",
    },
  ];
}
