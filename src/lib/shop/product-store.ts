import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { publicCacheTags } from "@/lib/cache/public-cache-tags";
import type { MediaUsage } from "@/lib/media/media-model";
import {
  buildMediaVariantSources,
  pickMediaVariantForRole,
} from "@/lib/media/media-variant-policy";
import {
  deleteUnusedMediaAssetsByMasterPaths,
  mediaAssetBucket,
  readMediaUsagesByOwner,
} from "@/lib/media/media-store";
import {
  getSupabaseAdminClient,
  getSupabasePublicClient,
  isSupabaseConfigured,
  isSupabasePublicReadConfigured,
} from "@/lib/supabase/server";
import { productCatalog } from "./product-catalog";
import type {
  AvailabilityStatus,
  ConsepotProduct,
  LimitedType,
  ProductImage,
  ProductListItem,
  ProductKind,
  RestockCtaType,
} from "./product-model";

const dataFilePath = path.join(process.cwd(), "data", "shop-products.json");
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

type ProductRow = {
  id: string;
  slug: string;
  title_ko: string;
  short_description: string;
  story: string | null;
  story_json?: unknown;
  story_text?: string | null;
  category: string;
  kind: ProductKind;
  is_limited: boolean;
  limited_type: LimitedType;
  is_archived: boolean;
  restock_cta_type: RestockCtaType;
  availability_status: AvailabilityStatus;
  price_krw: number | null;
  stock_quantity: number | null;
  currency: "KRW";
  material: string | null;
  glaze: string | null;
  size: string | null;
  usage_note: string | null;
  care_note: string | null;
  shipping_note: string | null;
  published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProductListRow = Pick<
  ProductRow,
  | "availability_status"
  | "category"
  | "created_at"
  | "currency"
  | "id"
  | "is_archived"
  | "is_limited"
  | "kind"
  | "limited_type"
  | "price_krw"
  | "published"
  | "published_at"
  | "restock_cta_type"
  | "short_description"
  | "slug"
  | "stock_quantity"
  | "title_ko"
  | "updated_at"
>;

type ProductSelectRow = ProductRow;

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
  material: z.string().optional(),
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
  material?: string;
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
  if (isSupabaseConfigured()) {
    return readProductsFromSupabase();
  }

  return readProductsFromJson();
}

export async function writeProducts(products: ConsepotProduct[]) {
  if (isSupabaseConfigured()) {
    await writeProductsToSupabase(products);
    return;
  }

  const parsed = productListSchema.parse(products);
  await mkdir(path.dirname(dataFilePath), { recursive: true });
  await writeFile(dataFilePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
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
  if (isSupabaseConfigured()) {
    return readProductByIdFromSupabase(id);
  }

  const products = await readProducts();
  return products.find((product) => product.id === id) ?? null;
}

export async function getProductSlugs() {
  return readPublishedProductSlugsCached();
}

export async function createProductDraft(input: ProductDraftInput) {
  if (isSupabaseConfigured()) {
    return createProductDraftInSupabase(input);
  }

  return createProductDraftInJson(input);
}

export async function updateProduct(id: string, input: ProductUpdateInput) {
  if (isSupabaseConfigured()) {
    return updateProductInSupabase(id, input);
  }

  return updateProductInJson(id, input);
}

export async function updateProductInventory(
  id: string,
  input: ProductInventoryUpdateInput,
) {
  if (isSupabaseConfigured()) {
    return updateProductInventoryInSupabase(id, input);
  }

  return updateProductInventoryInJson(id, input);
}

export async function deleteProduct(id: string) {
  if (isSupabaseConfigured()) {
    return deleteProductInSupabase(id);
  }

  return deleteProductInJson(id);
}

export async function deleteProductImageAssets(images: ProductImage[]) {
  if (!isSupabaseConfigured()) {
    return;
  }

  const masterPaths = images
    .map((image) => image.storagePath)
    .filter((storagePath): storagePath is string => Boolean(storagePath));

  if (masterPaths.length === 0) {
    return;
  }

  await deleteUnusedMediaAssetsByMasterPaths(masterPaths);
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
    if (isSupabasePublicReadConfigured()) {
      return readProductsFromSupabaseQuery(
        { published: true },
        getSupabasePublicClient(),
      );
    }

    if (isSupabaseConfigured()) {
      return readProductsFromSupabaseQuery({ published: true });
    }

    const products = await readProductsFromJson();
    return products.filter((product) => product.published);
  },
  ["published-products"],
  {
    revalidate: 3600,
    tags: [publicCacheTags.products],
  },
);

const readPublishedProductListItemsCached = unstable_cache(
  async (limit: number | null) => {
    if (isSupabasePublicReadConfigured()) {
      return readProductListItemsFromSupabaseQuery(
        { limit: limit ?? undefined, published: true },
        getSupabasePublicClient(),
      );
    }

    if (isSupabaseConfigured()) {
      return readProductListItemsFromSupabaseQuery({
        limit: limit ?? undefined,
        published: true,
      });
    }

    const products = await readProductsFromJson();
    const items = productListItemListSchema.parse(
      products.filter((product) => product.published).map(toProductListItem),
    );

    return typeof limit === "number" ? items.slice(0, limit) : items;
  },
  ["published-product-list-items"],
  {
    revalidate: 3600,
    tags: [publicCacheTags.products],
  },
);

const readPublishedProductBySlugCached = unstable_cache(
  async (slug: string) => {
    if (isSupabasePublicReadConfigured()) {
      const products = await readProductsFromSupabaseQuery(
        { limit: 1, published: true, slug },
        getSupabasePublicClient(),
      );
      return products[0] ?? null;
    }

    if (isSupabaseConfigured()) {
      const products = await readProductsFromSupabaseQuery({
        limit: 1,
        published: true,
        slug,
      });
      return products[0] ?? null;
    }

    const products = await readProductsFromJson();
    return (
      products.find((product) => product.published && product.slug === slug) ??
      null
    );
  },
  ["published-product-by-slug"],
  {
    revalidate: 3600,
    tags: [publicCacheTags.products],
  },
);

const readPublishedProductSlugsCached = unstable_cache(
  async () => {
    if (isSupabasePublicReadConfigured()) {
      return readPublishedProductSlugsFromSupabase(getSupabasePublicClient());
    }

    if (isSupabaseConfigured()) {
      return readPublishedProductSlugsFromSupabase();
    }

    const products = await readProductsFromJson();
    return products
      .filter((product) => product.published)
      .map((product) => product.slug);
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
    throw new Error(`Supabase ?곹뭹 議고쉶 ?ㅽ뙣: ${error.message}`);
  }

  const rows = (data ?? []) as ProductSelectRow[];
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
  let query = supabase
    .from("shop_products")
    .select(
      `
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
      `,
    )
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
    throw new Error(`Supabase 상품 목록 조회 실패: ${error.message}`);
  }

  const rows = (data ?? []) as ProductListRow[];
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

  return ((data ?? []) as Array<{ slug: string }>).map((row) => row.slug);
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
    published: false,
    restockCtaType: "restock_alert",
    shortDescription: "?곹뭹 ?ㅻ챸???낅젰??二쇱꽭??",
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
    throw new Error("?곹뭹??李얠쓣 ???놁뒿?덈떎.");
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
    material: emptyToUndefined(input.material),
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
    throw new Error(`Supabase ?곹뭹 ?ш퀬 ????ㅽ뙣: ${error.message}`);
  }

  return getProductById(id);
}

async function deleteProductInSupabase(id: string) {
  const current = await getProductById(id);

  if (!current) {
    throw new Error("?곹뭹??李얠쓣 ???놁뒿?덈떎.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.rpc("delete_shop_product_with_relations", {
    target_product_id: id,
  });

  if (error) {
    throw new Error(`Supabase ?곹뭹 ??젣 ?ㅽ뙣: ${error.message}`);
  }

  return current;
}

async function readProductsFromJson() {
  try {
    const file = await readFile(dataFilePath, "utf8");
    return productListSchema.parse(JSON.parse(file));
  } catch (error) {
    if (isMissingFileError(error)) {
      return getSeedProducts();
    }

    throw error;
  }
}

async function createProductDraftInJson(input: ProductDraftInput) {
  const now = new Date().toISOString();
  const products = await readProductsFromJson();
  const slug = normalizeSlug(input.slug);

  if (products.some((product) => product.slug === slug)) {
    throw new Error("?대? ?ъ슜 以묒씤 slug?낅땲??");
  }

  const product: ConsepotProduct = productSchema.parse({
    category: "cup",
    commerce: {
      availabilityStatus: "upcoming",
      currency: "KRW",
      price: null,
      source: "internal",
      stockQuantity: null,
    },
    createdAt: now,
    id: randomUUID(),
    images: [],
    isArchived: false,
    isLimited: false,
    kind: "regular",
    limitedType: null,
    published: false,
    restockCtaType: "restock_alert",
    shortDescription: "?곹뭹 ?ㅻ챸???낅젰??二쇱꽭??",
    slug,
    titleKo: input.titleKo.trim(),
    updatedAt: now,
  });

  await writeJsonProducts([product, ...products]);
  return product;
}

async function updateProductInJson(id: string, input: ProductUpdateInput) {
  const products = await readProductsFromJson();
  const now = new Date().toISOString();
  const nextSlug = normalizeSlug(input.slug);
  const current = products.find((product) => product.id === id);

  if (!current) {
    throw new Error("?곹뭹??李얠쓣 ???놁뒿?덈떎.");
  }

  if (
    products.some((product) => product.id !== id && product.slug === nextSlug)
  ) {
    throw new Error("?대? ?ъ슜 以묒씤 slug?낅땲??");
  }

  const nextProducts = products.map((product) =>
    product.id === id
      ? productSchema.parse({
          ...product,
          careNote: emptyToUndefined(input.careNote),
          category: input.category.trim(),
          commerce: {
            ...product.commerce,
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
          material: emptyToUndefined(input.material),
          published: input.published,
          publishedAt:
            input.published && !product.publishedAt
              ? now.slice(0, 10)
              : product.publishedAt,
          restockCtaType: input.restockCtaType,
          shippingNote: emptyToUndefined(input.shippingNote),
          shortDescription: input.shortDescription.trim(),
          size: emptyToUndefined(input.size),
          slug: nextSlug,
          story: emptyToUndefined(input.story),
          storyBody: createParagraphStoryBody(input.story ?? ""),
          storyText: input.story?.trim() ?? "",
          titleKo: input.titleKo.trim(),
          updatedAt: now,
          usageNote: emptyToUndefined(input.usageNote),
        })
      : product,
  );

  await writeJsonProducts(nextProducts);
  return nextProducts.find((product) => product.id === id) ?? null;
}

async function updateProductInventoryInJson(
  id: string,
  input: ProductInventoryUpdateInput,
) {
  const products = await readProductsFromJson();
  const nextProducts = products.map((product) =>
    product.id === id
      ? productSchema.parse({
          ...product,
          commerce: {
            ...product.commerce,
            availabilityStatus: input.availabilityStatus,
            stockQuantity: input.stockQuantity,
          },
          updatedAt: new Date().toISOString(),
        })
      : product,
  );

  await writeJsonProducts(nextProducts);
  return nextProducts.find((product) => product.id === id) ?? null;
}

async function deleteProductInJson(id: string) {
  const products = await readProductsFromJson();
  const current = products.find((product) => product.id === id);

  if (!current) {
    throw new Error("?곹뭹??李얠쓣 ???놁뒿?덈떎.");
  }

  await writeJsonProducts(products.filter((product) => product.id !== id));
  return current;
}

async function writeJsonProducts(products: ConsepotProduct[]) {
  const parsed = productListSchema.parse(products);
  await mkdir(path.dirname(dataFilePath), { recursive: true });
  await writeFile(dataFilePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
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

    const hasExplicitRole =
      image.isPrimary ||
      image.isListImage ||
      image.isDetail ||
      image.isDescription;
    const roles = [
      image.isPrimary ? "cover" : null,
      image.isListImage ? "list" : null,
      image.isDetail || !hasExplicitRole ? "detail" : null,
      image.isDescription ? "description" : null,
    ].filter(
      (
        role,
      ): role is "cover" | "description" | "detail" | "list" =>
        Boolean(role),
    );

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
    images: mediaUsagesToProductImages(usages),
    isArchived: row.is_archived,
    isLimited: row.is_limited,
    kind: row.kind,
    limitedType: row.limited_type,
    material: row.material ?? undefined,
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
    images: mediaUsagesToProductImages(usages),
    isArchived: row.is_archived,
    isLimited: row.is_limited,
    kind: row.kind,
    limitedType: row.limited_type,
    published: row.published,
    publishedAt: row.published_at ?? undefined,
    restockCtaType: row.restock_cta_type,
    shortDescription: row.short_description,
    slug: row.slug,
    titleKo: row.title_ko,
    updatedAt: row.updated_at,
  });
}

function toProductListItem(product: ConsepotProduct): ProductListItem {
  return productListItemSchema.parse({
    category: product.category,
    commerce: product.commerce,
    createdAt: product.createdAt,
    id: product.id,
    images: product.images,
    isArchived: product.isArchived,
    isLimited: product.isLimited,
    kind: product.kind,
    limitedType: product.limitedType,
    published: product.published,
    publishedAt: product.publishedAt,
    restockCtaType: product.restockCtaType,
    shortDescription: product.shortDescription,
    slug: product.slug,
    titleKo: product.titleKo,
    updatedAt: product.updatedAt,
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
    material: product.material ?? null,
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

function getSeedProducts(): ConsepotProduct[] {
  return productCatalog;
}

function mediaUsagesToProductImages(usages: MediaUsage[]) {
  const grouped = new Map<string, MediaUsage[]>();

  for (const usage of usages) {
    const assetUsages = grouped.get(usage.assetId) ?? [];
    assetUsages.push(usage);
    grouped.set(usage.assetId, assetUsages);
  }

  const sortOrderByAssetId = new Map(
    [...grouped.entries()].map(([assetId, assetUsages]) => [
      assetId,
      Math.min(...assetUsages.map((usage) => usage.sortOrder)),
    ]),
  );

  return [...grouped.values()]
    .map((assetUsages) => {
      const asset = assetUsages[0]?.asset;

      if (!asset) {
        return null;
      }

      const roles = new Set(assetUsages.map((usage) => usage.role));
      const primaryUsage =
        assetUsages.find((usage) => usage.role === "cover") ??
        assetUsages.find((usage) => usage.role === "list") ??
        assetUsages[0];
      const variantRole =
        roles.has("list") ? "list" : (primaryUsage?.role ?? "detail");
      const imageVariant = pickMediaVariantForRole(
        asset,
        "product",
        variantRole,
      );
      const variants = buildMediaVariantSources(asset);

      return imageSchema.parse({
        alt: primaryUsage?.altOverride ?? asset.alt,
        caption: primaryUsage?.captionOverride ?? asset.caption,
        height: imageVariant?.height ?? asset.height,
        id: asset.id,
        isDescription: roles.has("description"),
        isDetail: roles.has("detail"),
        isListImage: roles.has("list"),
        isPrimary: roles.has("cover"),
        src: imageVariant?.src ?? asset.src,
        storagePath: asset.masterPath,
        variants,
        width: imageVariant?.width ?? asset.width,
      });
    })
    .filter((image): image is ProductImage => Boolean(image))
    .sort((a, b) => {
      const aOrder = sortOrderByAssetId.get(a.id ?? "") ?? 0;
      const bOrder = sortOrderByAssetId.get(b.id ?? "") ?? 0;

      return aOrder - bOrder;
    });
}

function normalizeProductImages(images: ProductImage[], fallbackTitle: string) {
  const cleaned = images
    .map((image) => ({
      alt: image.alt.trim() || `${fallbackTitle.trim() || "?곹뭹"} ?대?吏`,
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

function isMissingFileError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
