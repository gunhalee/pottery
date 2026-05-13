import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { publicCacheTags } from "@/lib/cache/public-cache-tags";
import type { MediaUsage } from "@/lib/media/media-model";
import { getProductImageUsageRoles } from "@/lib/media/media-role-requirements";
import {
  deleteUnusedMediaAssetsByMasterPaths,
  mediaAssetBucket,
  readMediaUsagesByOwner,
} from "@/lib/media/media-store";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { getSupabasePublicReadClient } from "@/lib/supabase/read-client";
import {
  parseProductListRows,
  parseProductRows,
  parseProductSlugRows,
  type ProductListRow,
  type ProductSelectRow,
} from "./product-store-rows";
import type {
  AvailabilityStatus,
  ConsepotProduct,
  LimitedType,
  ProductImage,
  ProductListItem,
  ProductKind,
  RestockCtaType,
} from "./product-model";
import { createProductImagesFromMediaUsages } from "./product-media-images";

export const productImageBucket = mediaAssetBucket;
const emptyProductStoryBody = {
  root: {
    children: [],
    direction: null,
    format: "",
    indent: 0,
    type: "root",
    version: 1,
  },
};

type ProductQueryOptions = {
  id?: string;
  limit?: number;
  published?: boolean;
  slug?: string;
};

const imageVariantSourceSchema = z.object({
  height: z.number().int().positive(),
  src: z.string().min(1),
  storagePath: z.string().optional(),
  variant: z.enum(["detail", "list", "master", "thumbnail"]),
  width: z.number().int().positive(),
});

const imageVariantsSchema = z
  .object({
    detail: imageVariantSourceSchema.optional(),
    list: imageVariantSourceSchema.optional(),
    master: imageVariantSourceSchema.optional(),
    thumbnail: imageVariantSourceSchema.optional(),
  })
  .optional();

const imageSchema = z.object({
  alt: z.string().min(1),
  caption: z.string().optional(),
  height: z.number().int().positive().optional(),
  id: z.string().optional(),
  isDescription: z.boolean().optional(),
  isDetail: z.boolean().optional(),
  isListImage: z.boolean().optional(),
  isPrimary: z.boolean().optional(),
  placeholderLabel: z.string().optional(),
  src: z.string().optional(),
  storagePath: z.string().optional(),
  variants: imageVariantsSchema,
  width: z.number().int().positive().optional(),
});

const commerceSchema = z.object({
  availabilityStatus: z.enum(["available", "sold_out", "upcoming", "archive"]),
  currency: z.literal("KRW"),
  price: z.number().int().nonnegative().nullable(),
  source: z.literal("internal"),
  stockQuantity: z.number().int().nonnegative().nullable(),
  syncedAt: z.string().optional(),
});

const plantOptionSchema = z
  .object({
    careNotice: z.string().optional(),
    enabled: z.boolean(),
    priceDelta: z.number().int().nonnegative(),
    returnNotice: z.string().optional(),
    shippingRestrictionNotice: z.string().optional(),
    species: z.string().optional(),
  })
  .default({
    enabled: false,
    priceDelta: 0,
  });

const madeToOrderSchema = z
  .object({
    available: z.boolean(),
    daysMax: z.number().int().positive(),
    daysMin: z.number().int().positive(),
    notice: z.string().optional(),
  })
  .refine((value) => value.daysMax >= value.daysMin, {
    message: "추가 제작 최대 소요일은 최소 소요일보다 크거나 같아야 합니다.",
  })
  .default({
    available: false,
    daysMax: 45,
    daysMin: 30,
  });

const productSchema = z.object({
  careNote: z.string().optional(),
  category: z.string().min(1),
  commerce: commerceSchema,
  createdAt: z.string(),
  glaze: z.string().optional(),
  id: z.string().min(1),
  images: z.array(imageSchema),
  isArchived: z.boolean(),
  isLimited: z.boolean(),
  kind: z.enum(["regular", "one_of_a_kind"]),
  limitedType: z
    .enum(["quantity", "period", "kiln_batch", "project"])
    .nullable(),
  madeToOrder: madeToOrderSchema,
  material: z.string().optional(),
  plantOption: plantOptionSchema,
  published: z.boolean(),
  publishedAt: z.string().optional(),
  restockCtaType: z
    .enum(["restock_alert", "similar_work_alert", "next_limited_alert"])
    .nullable(),
  shippingNote: z.string().optional(),
  shortDescription: z.string().min(1),
  size: z.string().optional(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  story: z.string().optional(),
  storyBody: z.unknown().optional(),
  storyText: z.string().optional(),
  titleKo: z.string().min(1),
  updatedAt: z.string(),
  usageNote: z.string().optional(),
});

const productListItemSchema = productSchema.pick({
  category: true,
  commerce: true,
  createdAt: true,
  id: true,
  images: true,
  isArchived: true,
  isLimited: true,
  kind: true,
  limitedType: true,
  madeToOrder: true,
  plantOption: true,
  published: true,
  publishedAt: true,
  restockCtaType: true,
  shortDescription: true,
  slug: true,
  titleKo: true,
  updatedAt: true,
});

const productListSchema = z.array(productSchema);
const productListItemListSchema = z.array(productListItemSchema);

export type ProductDraftInput = {
  slug: string;
  titleKo: string;
};

export type ProductUpdateInput = {
  availabilityStatus: AvailabilityStatus;
  careNote?: string;
  category: string;
  glaze?: string;
  images: ProductImage[];
  isArchived: boolean;
  isLimited: boolean;
  kind: ProductKind;
  limitedType: LimitedType;
  madeToOrderAvailable: boolean;
  madeToOrderDaysMax: number;
  madeToOrderDaysMin: number;
  madeToOrderNotice?: string;
  material?: string;
  plantCareNotice?: string;
  plantOptionEnabled: boolean;
  plantOptionPriceDelta: number;
  plantReturnNotice?: string;
  plantShippingRestrictionNotice?: string;
  plantSpecies?: string;
  price: number | null;
  published: boolean;
  restockCtaType: RestockCtaType;
  shippingNote?: string;
  shortDescription: string;
  size?: string;
  slug: string;
  stockQuantity: number | null;
  story?: string;
  titleKo: string;
  usageNote?: string;
};

export type ProductInventoryUpdateInput = {
  availabilityStatus: AvailabilityStatus;
  stockQuantity: number | null;
};

export async function readProducts(): Promise<ConsepotProduct[]> {
  requireProductSupabaseStore();
  return readProductsFromSupabase();
}

export async function writeProducts(products: ConsepotProduct[]) {
  requireProductSupabaseStore();

  const parsed = productListSchema.parse(products);
  await writeProductsToSupabase(parsed);
}

export async function getPublishedProducts() {
  return readPublishedProductsCached();
}

export async function getPublishedProductListItems(limit?: number) {
  return readPublishedProductListItemsCached(limit ?? null);
}

export async function getProductBySlug(slug: string) {
  return readPublishedProductBySlugCached(slug);
}

export async function getProductById(id: string) {
  requireProductSupabaseStore();
  return readProductByIdFromSupabase(id);
}

export async function getProductSlugs() {
  return readPublishedProductSlugsCached();
}

export async function createProductDraft(input: ProductDraftInput) {
  requireProductSupabaseStore();
  return createProductDraftInSupabase(input);
}

export async function updateProduct(id: string, input: ProductUpdateInput) {
  requireProductSupabaseStore();
  return updateProductInSupabase(id, input);
}

export async function updateProductInventory(
  id: string,
  input: ProductInventoryUpdateInput,
) {
  requireProductSupabaseStore();
  return updateProductInventoryInSupabase(id, input);
}

export async function deleteProduct(id: string) {
  requireProductSupabaseStore();
  return deleteProductInSupabase(id);
}

export async function deleteProductImageAssets(images: ProductImage[]) {
  const masterPaths = images
    .map((image) => image.storagePath)
    .filter((storagePath): storagePath is string => Boolean(storagePath));

  if (masterPaths.length === 0) {
    return;
  }

  requireProductSupabaseStore();
  await deleteUnusedMediaAssetsByMasterPaths(masterPaths);
}

function requireProductSupabaseStore() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 상품 저장소가 구성되지 않았습니다.");
  }
}

export function normalizeSlug(slug: string) {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function readProductsFromSupabase() {
  return readProductsFromSupabaseQuery();
}

const readPublishedProductsCached = unstable_cache(
  async () => {
    return readProductsFromSupabaseQuery(
      { published: true },
      getSupabasePublicReadClient(),
    );
  },
  ["published-products"],
  {
    revalidate: 3600,
    tags: [publicCacheTags.products],
  },
);

const readPublishedProductListItemsCached = unstable_cache(
  async (limit: number | null) => {
    return readProductListItemsFromSupabaseQuery(
      {
        limit: limit ?? undefined,
        published: true,
      },
      getSupabasePublicReadClient(),
    );
  },
  ["published-product-list-items"],
  {
    revalidate: 3600,
    tags: [publicCacheTags.products],
  },
);

const readPublishedProductBySlugCached = unstable_cache(
  async (slug: string) => {
    const products = await readProductsFromSupabaseQuery(
      { limit: 1, published: true, slug },
      getSupabasePublicReadClient(),
    );
    return products[0] ?? null;
  },
  ["published-product-by-slug"],
  {
    revalidate: 3600,
    tags: [publicCacheTags.products],
  },
);

const readPublishedProductSlugsCached = unstable_cache(
  async () => {
    return readPublishedProductSlugsFromSupabase(getSupabasePublicReadClient());
  },
  ["published-product-slugs"],
  {
    revalidate: 3600,
    tags: [publicCacheTags.products],
  },
);

async function readProductByIdFromSupabase(id: string) {
  const products = await readProductsFromSupabaseQuery({ id, limit: 1 });
  return products[0] ?? null;
}

async function readProductsFromSupabaseQuery(
  options: ProductQueryOptions = {},
  client?: SupabaseClient,
) {
  const supabase = client ?? getSupabaseAdminClient();
  let query = supabase
    .from("shop_products")
    .select("*")
    .order("created_at", { ascending: false });

  if (options.id) {
    query = query.eq("id", options.id);
  }

  if (options.slug) {
    query = query.eq("slug", options.slug);
  }

  if (typeof options.published === "boolean") {
    query = query.eq("published", options.published);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Supabase 상품 조회 실패: ${error.message}`);
  }

  const rows = parseProductRows(data);
  const usageMap = await readMediaUsagesByOwner(
    "product",
    rows.map((row) => row.id),
    { client: supabase },
  );

  return productListSchema.parse(
    rows.map((row) => fromSupabaseRow(row, usageMap.get(row.id) ?? [])),
  );
}

async function readProductListItemsFromSupabaseQuery(
  options: ProductQueryOptions = {},
  client?: SupabaseClient,
) {
  const supabase = client ?? getSupabaseAdminClient();
  const fullResult = await buildProductListQuery({
    client: supabase,
    options,
    select: productListSelectWithCommerceExtensions,
  });
  const { data, error } =
    fullResult.error && isMissingOptionalProductCommerceColumn(fullResult.error)
      ? await buildProductListQuery({
          client: supabase,
          options,
          select: productListSelectBase,
        })
      : fullResult;

  if (error) {
    throw new Error(`Supabase 상품 목록 조회 실패: ${error.message}`);
  }

  const rows = parseProductListRows(data);
  const usageMap = await readMediaUsagesByOwner(
    "product",
    rows.map((row) => row.id),
    { client: supabase, roles: ["cover", "detail", "list"] },
  );

  return productListItemListSchema.parse(
    rows.map((row) =>
      fromSupabaseProductListRow(row, usageMap.get(row.id) ?? []),
    ),
  );
}

const productListSelectBase = `
  id,
  slug,
  title_ko,
  short_description,
  category,
  kind,
  is_limited,
  limited_type,
  is_archived,
  restock_cta_type,
  availability_status,
  price_krw,
  stock_quantity,
  currency,
  published,
  published_at,
  created_at,
  updated_at
`;

const productListSelectWithCommerceExtensions = `
  ${productListSelectBase},
  plant_option_enabled,
  plant_option_price_delta_krw,
  plant_species,
  plant_care_notice,
  plant_return_notice,
  plant_shipping_restriction_notice,
  made_to_order_available,
  made_to_order_days_min,
  made_to_order_days_max,
  made_to_order_notice
`;

function buildProductListQuery({
  client,
  options,
  select,
}: {
  client: SupabaseClient;
  options: ProductQueryOptions;
  select: string;
}) {
  let query = client
    .from("shop_products")
    .select(select)
    .order("created_at", { ascending: false });

  if (options.id) {
    query = query.eq("id", options.id);
  }

  if (options.slug) {
    query = query.eq("slug", options.slug);
  }

  if (typeof options.published === "boolean") {
    query = query.eq("published", options.published);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  return query;
}

async function readPublishedProductSlugsFromSupabase(client?: SupabaseClient) {
  const supabase = client ?? getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_products")
    .select("slug")
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Supabase 상품 slug 조회 실패: ${error.message}`);
  }

  return parseProductSlugRows(data).map((row) => row.slug);
}

async function writeProductsToSupabase(products: ConsepotProduct[]) {
  const parsed = productListSchema.parse(products);

  for (const product of parsed) {
    await saveProductWithRelationsInSupabase(product);
  }
}

async function createProductDraftInSupabase(input: ProductDraftInput) {
  const id = randomUUID();
  const slug = normalizeSlug(input.slug);
  const titleKo = input.titleKo.trim();

  const product: ConsepotProduct = productSchema.parse({
    category: "cup",
    commerce: {
      availabilityStatus: "upcoming",
      currency: "KRW",
      price: null,
      source: "internal",
      stockQuantity: null,
    },
    createdAt: new Date().toISOString(),
    id,
    images: [],
    isArchived: false,
    isLimited: false,
    kind: "regular",
    limitedType: null,
    madeToOrder: {
      available: false,
      daysMax: 45,
      daysMin: 30,
    },
    plantOption: {
      enabled: false,
      priceDelta: 0,
    },
    published: false,
    restockCtaType: "restock_alert",
    shortDescription: "상품 설명을 입력해 주세요.",
    slug,
    titleKo,
    updatedAt: new Date().toISOString(),
  });

  await saveProductWithRelationsInSupabase(product);

  return (await getProductById(id)) ?? product;
}

async function updateProductInSupabase(id: string, input: ProductUpdateInput) {
  const current = await getProductById(id);

  if (!current) {
    throw new Error("상품을 찾을 수 없습니다.");
  }

  const product = productSchema.parse({
    ...current,
    careNote: emptyToUndefined(input.careNote),
    category: input.category.trim(),
    commerce: {
      ...current.commerce,
      availabilityStatus: input.availabilityStatus,
      price: input.price,
      stockQuantity: input.stockQuantity,
    },
    glaze: emptyToUndefined(input.glaze),
    images: normalizeProductImages(input.images, input.titleKo),
    isArchived: input.isArchived,
    isLimited: input.isLimited,
    kind: input.kind,
    limitedType: input.isLimited ? input.limitedType : null,
    madeToOrder: {
      available: input.madeToOrderAvailable,
      daysMax: input.madeToOrderDaysMax,
      daysMin: input.madeToOrderDaysMin,
      notice: emptyToUndefined(input.madeToOrderNotice),
    },
    material: emptyToUndefined(input.material),
    plantOption: {
      careNotice: emptyToUndefined(input.plantCareNotice),
      enabled: input.plantOptionEnabled,
      priceDelta: input.plantOptionPriceDelta,
      returnNotice: emptyToUndefined(input.plantReturnNotice),
      shippingRestrictionNotice: emptyToUndefined(
        input.plantShippingRestrictionNotice,
      ),
      species: emptyToUndefined(input.plantSpecies),
    },
    published: input.published,
    publishedAt:
      input.published && !current.publishedAt
        ? new Date().toISOString().slice(0, 10)
        : current.publishedAt,
    restockCtaType: input.restockCtaType,
    shippingNote: emptyToUndefined(input.shippingNote),
    shortDescription: input.shortDescription.trim(),
    size: emptyToUndefined(input.size),
    slug: normalizeSlug(input.slug),
    story: emptyToUndefined(input.story),
    storyBody: createParagraphStoryBody(input.story ?? ""),
    storyText: input.story?.trim() ?? "",
    titleKo: input.titleKo.trim(),
    updatedAt: new Date().toISOString(),
    usageNote: emptyToUndefined(input.usageNote),
  });

  await saveProductWithRelationsInSupabase(product);

  return (await getProductById(id)) ?? product;
}

async function updateProductInventoryInSupabase(
  id: string,
  input: ProductInventoryUpdateInput,
) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("shop_products")
    .update({
      availability_status: input.availabilityStatus,
      stock_quantity: input.stockQuantity,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Supabase 상품 재고 저장 실패: ${error.message}`);
  }

  return getProductById(id);
}

async function deleteProductInSupabase(id: string) {
  const current = await getProductById(id);

  if (!current) {
    throw new Error("상품을 찾을 수 없습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.rpc("delete_shop_product_with_relations", {
    target_product_id: id,
  });

  if (error) {
    throw new Error(`Supabase 상품 삭제 실패: ${error.message}`);
  }

  return current;
}

async function saveProductWithRelationsInSupabase(product: ConsepotProduct) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.rpc("save_shop_product_with_relations", {
    media_usage_rows: toSupabaseProductMediaUsageRows(product),
    product_row: toSupabaseProductRow(product),
  });

  if (error) {
    throw new Error(`Supabase 상품 관계 저장 실패: ${error.message}`);
  }
}

function toSupabaseProductMediaUsageRows(product: ConsepotProduct) {
  return product.images.flatMap((image, index) => {
    if (!image.id || !image.src) {
      return [];
    }

    const roles = getProductImageUsageRoles(image);

    return roles.map((role) => ({
      alt_override: image.alt,
      asset_id: image.id!,
      caption_override: image.caption ?? null,
      layout: null,
      role,
      sort_order: index,
    }));
  });
}

function fromSupabaseRow(
  row: ProductSelectRow,
  usages: MediaUsage[],
): ConsepotProduct {
  return productSchema.parse({
    careNote: row.care_note ?? undefined,
    category: row.category,
    commerce: {
      availabilityStatus: row.availability_status,
      currency: row.currency,
      price: row.price_krw,
      source: "internal",
      stockQuantity: row.stock_quantity,
    },
    createdAt: row.created_at,
    glaze: row.glaze ?? undefined,
    id: row.id,
    images: createProductImagesFromMediaUsages(usages),
    isArchived: row.is_archived,
    isLimited: row.is_limited,
    kind: row.kind,
    limitedType: row.limited_type,
    madeToOrder: {
      available: row.made_to_order_available ?? false,
      daysMax: row.made_to_order_days_max ?? 45,
      daysMin: row.made_to_order_days_min ?? 30,
      notice: row.made_to_order_notice ?? undefined,
    },
    material: row.material ?? undefined,
    plantOption: {
      careNotice: row.plant_care_notice ?? undefined,
      enabled: row.plant_option_enabled ?? false,
      priceDelta: row.plant_option_price_delta_krw ?? 0,
      returnNotice: row.plant_return_notice ?? undefined,
      shippingRestrictionNotice:
        row.plant_shipping_restriction_notice ?? undefined,
      species: row.plant_species ?? undefined,
    },
    published: row.published,
    publishedAt: row.published_at ?? undefined,
    restockCtaType: row.restock_cta_type,
    shippingNote: row.shipping_note ?? undefined,
    shortDescription: row.short_description,
    size: row.size ?? undefined,
    slug: row.slug,
    story: row.story_text ?? row.story ?? undefined,
    storyBody: row.story_json ?? undefined,
    storyText: row.story_text ?? row.story ?? undefined,
    titleKo: row.title_ko,
    updatedAt: row.updated_at,
    usageNote: row.usage_note ?? undefined,
  });
}

function fromSupabaseProductListRow(
  row: ProductListRow,
  usages: MediaUsage[],
): ProductListItem {
  return productListItemSchema.parse({
    category: row.category,
    commerce: {
      availabilityStatus: row.availability_status,
      currency: row.currency,
      price: row.price_krw,
      source: "internal",
      stockQuantity: row.stock_quantity,
    },
    createdAt: row.created_at,
    id: row.id,
    images: createProductImagesFromMediaUsages(usages),
    isArchived: row.is_archived,
    isLimited: row.is_limited,
    kind: row.kind,
    limitedType: row.limited_type,
    madeToOrder: {
      available: row.made_to_order_available ?? false,
      daysMax: row.made_to_order_days_max ?? 45,
      daysMin: row.made_to_order_days_min ?? 30,
      notice: row.made_to_order_notice ?? undefined,
    },
    plantOption: {
      careNotice: row.plant_care_notice ?? undefined,
      enabled: row.plant_option_enabled ?? false,
      priceDelta: row.plant_option_price_delta_krw ?? 0,
      returnNotice: row.plant_return_notice ?? undefined,
      shippingRestrictionNotice:
        row.plant_shipping_restriction_notice ?? undefined,
      species: row.plant_species ?? undefined,
    },
    published: row.published,
    publishedAt: row.published_at ?? undefined,
    restockCtaType: row.restock_cta_type,
    shortDescription: row.short_description,
    slug: row.slug,
    titleKo: row.title_ko,
    updatedAt: row.updated_at,
  });
}

function toSupabaseProductRow(product: ConsepotProduct) {
  return {
    availability_status: product.commerce.availabilityStatus,
    care_note: product.careNote ?? null,
    category: product.category,
    currency: product.commerce.currency,
    glaze: product.glaze ?? null,
    id: product.id,
    is_archived: product.isArchived,
    is_limited: product.isLimited,
    kind: product.kind,
    limited_type: product.limitedType,
    made_to_order_available: product.madeToOrder.available,
    made_to_order_days_max: product.madeToOrder.daysMax,
    made_to_order_days_min: product.madeToOrder.daysMin,
    made_to_order_notice: product.madeToOrder.notice ?? null,
    material: product.material ?? null,
    plant_care_notice: product.plantOption.careNotice ?? null,
    plant_option_enabled: product.plantOption.enabled,
    plant_option_price_delta_krw: product.plantOption.priceDelta,
    plant_return_notice: product.plantOption.returnNotice ?? null,
    plant_shipping_restriction_notice:
      product.plantOption.shippingRestrictionNotice ?? null,
    plant_species: product.plantOption.species ?? null,
    price_krw: product.commerce.price,
    published: product.published,
    published_at: product.publishedAt ?? null,
    restock_cta_type: product.restockCtaType,
    shipping_note: product.shippingNote ?? null,
    short_description: product.shortDescription,
    size: product.size ?? null,
    slug: product.slug,
    stock_quantity: product.commerce.stockQuantity,
    story: product.story ?? null,
    story_json:
      product.storyBody ?? createParagraphStoryBody(product.story ?? ""),
    story_text: product.storyText ?? product.story ?? "",
    title_ko: product.titleKo,
    updated_at: product.updatedAt,
    usage_note: product.usageNote ?? null,
  };
}

function normalizeProductImages(images: ProductImage[], fallbackTitle: string) {
  const cleaned = images
    .map((image) => ({
      alt: image.alt.trim() || `${fallbackTitle.trim() || "상품"} 이미지`,
      caption: emptyToUndefined(image.caption),
      height: image.height,
      id: emptyToUndefined(image.id),
      isDescription: Boolean(image.isDescription),
      isDetail: Boolean(image.isDetail),
      isListImage: Boolean(image.isListImage),
      isPrimary: Boolean(image.isPrimary),
      placeholderLabel: emptyToUndefined(image.placeholderLabel),
      src: emptyToUndefined(image.src),
      storagePath: emptyToUndefined(image.storagePath),
      variants: image.variants,
      width: image.width,
    }))
    .filter((image) => image.src || image.placeholderLabel);

  const primaryIndex = cleaned.findIndex((image) => image.isPrimary);
  const listIndex = cleaned.findIndex((image) => image.isListImage);
  const nextPrimaryIndex = primaryIndex >= 0 ? primaryIndex : 0;
  const nextListIndex = listIndex >= 0 ? listIndex : -1;

  return cleaned.map((image, index) =>
    imageSchema.parse({
      ...image,
      isPrimary: index === nextPrimaryIndex,
      isListImage: index === nextListIndex,
    }),
  );
}

function emptyToUndefined(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function createParagraphStoryBody(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    return emptyProductStoryBody;
  }

  return {
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              text: trimmed,
              type: "text",
              version: 1,
            },
          ],
          direction: null,
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
        },
      ],
      direction: null,
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  };
}

function isMissingOptionalProductCommerceColumn(error: { message?: string }) {
  const message = error.message ?? "";

  return (
    message.includes("plant_option_") ||
    message.includes("made_to_order_") ||
    message.includes("schema cache")
  );
}
