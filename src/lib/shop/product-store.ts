import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { cafe24ProductMap } from "./cafe24-product-map";
import { productCatalog } from "./product-catalog";
import type {
  AvailabilityStatus,
  Cafe24ProductMapping,
  ConsepotProduct,
  LimitedType,
  ProductSyncLog,
  ProductKind,
  RestockCtaType,
} from "./product-model";

const dataFilePath = path.join(process.cwd(), "data", "shop-products.json");

type ProductRow = {
  id: string;
  slug: string;
  title_ko: string;
  short_description: string;
  story: string | null;
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

type ProductImageRow = {
  alt: string;
  cafe24_image_path: string | null;
  is_primary: boolean;
  placeholder_label: string | null;
  sort_order: number;
  src: string | null;
};

type Cafe24MappingRow = {
  category_no: number | null;
  checkout_url: string | null;
  display_group: number | null;
  last_sync_error: string | null;
  last_synced_at: string | null;
  mapping_status: Cafe24ProductMapping["mappingStatus"];
  product_no: string | null;
  product_url: string | null;
  variant_code: string | null;
};

type ProductSyncLogRow = {
  action: ProductSyncLog["action"];
  created_at: string;
  id: number;
  message: string | null;
  product_id: string;
  provider: "cafe24";
  request_payload: unknown;
  response_payload: unknown;
  status: ProductSyncLog["status"];
};

type ProductSelectRow = ProductRow & {
  shop_product_cafe24_mappings?: Cafe24MappingRow | Cafe24MappingRow[] | null;
  shop_product_images?: ProductImageRow[] | null;
};

const imageSchema = z.object({
  alt: z.string().min(1),
  cafe24ImagePath: z.string().optional(),
  isPrimary: z.boolean().optional(),
  placeholderLabel: z.string().optional(),
  src: z.string().optional(),
});

const commerceSchema = z.object({
  availabilityStatus: z.enum(["available", "sold_out", "upcoming", "archive"]),
  currency: z.literal("KRW"),
  price: z.number().int().nonnegative().nullable(),
  source: z.literal("cafe24"),
  stockQuantity: z.number().int().nonnegative().nullable(),
  syncedAt: z.string().optional(),
});

const cafe24Schema = z.object({
  categoryNo: z.number().int().positive().optional(),
  checkoutUrl: z.string().optional(),
  displayGroup: z.number().int().positive().optional(),
  lastSyncError: z.string().optional(),
  lastSyncedAt: z.string().optional(),
  mappingStatus: z.enum(["pending", "mapped", "sync_failed", "not_applicable"]),
  productNo: z.string().nullable(),
  productUrl: z.string().optional(),
  variantCode: z.string().optional(),
});

const productSchema = z.object({
  cafe24: cafe24Schema,
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
  titleKo: z.string().min(1),
  updatedAt: z.string(),
  usageNote: z.string().optional(),
});

const productListSchema = z.array(productSchema);

export type ProductDraftInput = {
  slug: string;
  titleKo: string;
};

export type ProductUpdateInput = {
  availabilityStatus: AvailabilityStatus;
  careNote?: string;
  category: string;
  glaze?: string;
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

export type ProductSyncLogInput = {
  action: ProductSyncLog["action"];
  message?: string | null;
  productId: string;
  requestPayload?: unknown;
  responsePayload?: unknown;
  status: ProductSyncLog["status"];
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
  const products = await readProducts();
  return products.filter((product) => product.published);
}

export async function getProductBySlug(slug: string) {
  const products = await getPublishedProducts();
  return products.find((product) => product.slug === slug) ?? null;
}

export async function getProductById(id: string) {
  const products = await readProducts();
  return products.find((product) => product.id === id) ?? null;
}

export async function getProductSlugs() {
  const products = await getPublishedProducts();
  return products.map((product) => product.slug);
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

export async function updateProductCafe24Mapping(
  id: string,
  cafe24: Cafe24ProductMapping,
) {
  if (isSupabaseConfigured()) {
    return updateProductCafe24MappingInSupabase(id, cafe24);
  }

  return updateProductCafe24MappingInJson(id, cafe24);
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

export async function readProductSyncLogs(productId: string, limit = 8) {
  if (!isSupabaseConfigured()) {
    return [] satisfies ProductSyncLog[];
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_product_sync_logs")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Supabase 동기화 로그 조회 실패: ${error.message}`);
  }

  return (data ?? []).map((row) =>
    fromSupabaseSyncLogRow(row as ProductSyncLogRow),
  );
}

export async function appendProductSyncLog(input: ProductSyncLogInput) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_product_sync_logs")
    .insert({
      action: input.action,
      message: input.message ?? null,
      product_id: input.productId,
      provider: "cafe24",
      request_payload: input.requestPayload ?? null,
      response_payload: input.responsePayload ?? null,
      status: input.status,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Supabase 동기화 로그 저장 실패: ${error.message}`);
  }

  return fromSupabaseSyncLogRow(data as ProductSyncLogRow);
}

export function normalizeSlug(slug: string) {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function readProductsFromSupabase() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_products")
    .select(
      `
        *,
        shop_product_images (*),
        shop_product_cafe24_mappings (*)
      `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Supabase 상품 조회 실패: ${error.message}`);
  }

  return productListSchema.parse(
    (data ?? []).map((row) => fromSupabaseRow(row as ProductSelectRow)),
  );
}

async function writeProductsToSupabase(products: ConsepotProduct[]) {
  const supabase = getSupabaseAdminClient();
  const parsed = productListSchema.parse(products);

  for (const product of parsed) {
    const { error: productError } = await supabase
      .from("shop_products")
      .upsert(toSupabaseProductRow(product), { onConflict: "id" });

    if (productError) {
      throw new Error(`Supabase 상품 저장 실패: ${productError.message}`);
    }

    await replaceProductImages(product);
    await upsertCafe24Mapping(product.id, product.cafe24);
  }
}

async function createProductDraftInSupabase(input: ProductDraftInput) {
  const supabase = getSupabaseAdminClient();
  const id = randomUUID();
  const slug = normalizeSlug(input.slug);
  const titleKo = input.titleKo.trim();

  const product: ConsepotProduct = productSchema.parse({
    cafe24: {
      categoryNo: getDefaultCategoryNo(),
      displayGroup: getDefaultDisplayGroup(),
      mappingStatus: "pending",
      productNo: null,
    },
    category: "cup",
    commerce: {
      availabilityStatus: "upcoming",
      currency: "KRW",
      price: null,
      source: "cafe24",
      stockQuantity: null,
    },
    createdAt: new Date().toISOString(),
    id,
    images: [
      {
        alt: `${titleKo} 대표 이미지`,
        isPrimary: true,
        placeholderLabel: titleKo,
      },
    ],
    isArchived: false,
    isLimited: false,
    kind: "regular",
    limitedType: null,
    published: false,
    restockCtaType: "restock_alert",
    shortDescription: "상품 설명을 입력해 주세요.",
    slug,
    titleKo,
    updatedAt: new Date().toISOString(),
  });

  const { error } = await supabase.from("shop_products").insert(
    toSupabaseProductRow(product),
  );

  if (error) {
    throw new Error(`Supabase 상품 초안 생성 실패: ${error.message}`);
  }

  await replaceProductImages(product);
  await upsertCafe24Mapping(product.id, product.cafe24);

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
    titleKo: input.titleKo.trim(),
    updatedAt: new Date().toISOString(),
    usageNote: emptyToUndefined(input.usageNote),
  });

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("shop_products")
    .update(toSupabaseProductRow(product))
    .eq("id", id);

  if (error) {
    throw new Error(`Supabase 상품 수정 실패: ${error.message}`);
  }

  return (await getProductById(id)) ?? product;
}

async function updateProductCafe24MappingInSupabase(
  id: string,
  cafe24: Cafe24ProductMapping,
) {
  await upsertCafe24Mapping(id, cafe24);
  return getProductById(id);
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
  const { error } = await supabase.from("shop_products").delete().eq("id", id);

  if (error) {
    throw new Error(`Supabase 상품 삭제 실패: ${error.message}`);
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
    throw new Error("이미 사용 중인 slug입니다.");
  }

  const product: ConsepotProduct = productSchema.parse({
    cafe24: {
      categoryNo: getDefaultCategoryNo(),
      displayGroup: getDefaultDisplayGroup(),
      mappingStatus: "pending",
      productNo: null,
    },
    category: "cup",
    commerce: {
      availabilityStatus: "upcoming",
      currency: "KRW",
      price: null,
      source: "cafe24",
      stockQuantity: null,
    },
    createdAt: now,
    id: randomUUID(),
    images: [
      {
        alt: `${input.titleKo} 대표 이미지`,
        isPrimary: true,
        placeholderLabel: input.titleKo,
      },
    ],
    isArchived: false,
    isLimited: false,
    kind: "regular",
    limitedType: null,
    published: false,
    restockCtaType: "restock_alert",
    shortDescription: "상품 설명을 입력해 주세요.",
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
    throw new Error("상품을 찾을 수 없습니다.");
  }

  if (
    products.some((product) => product.id !== id && product.slug === nextSlug)
  ) {
    throw new Error("이미 사용 중인 slug입니다.");
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
          images:
            product.images.length > 0
              ? product.images
              : [
                  {
                    alt: `${input.titleKo} 대표 이미지`,
                    isPrimary: true,
                    placeholderLabel: input.titleKo,
                  },
                ],
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
          titleKo: input.titleKo.trim(),
          updatedAt: now,
          usageNote: emptyToUndefined(input.usageNote),
        })
      : product,
  );

  await writeJsonProducts(nextProducts);
  return nextProducts.find((product) => product.id === id) ?? null;
}

async function updateProductCafe24MappingInJson(
  id: string,
  cafe24: Cafe24ProductMapping,
) {
  const products = await readProductsFromJson();
  const nextProducts = products.map((product) =>
    product.id === id
      ? productSchema.parse({
          ...product,
          cafe24,
          commerce: {
            ...product.commerce,
            syncedAt: cafe24.lastSyncedAt ?? product.commerce.syncedAt,
          },
          updatedAt: new Date().toISOString(),
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
    throw new Error("상품을 찾을 수 없습니다.");
  }

  await writeJsonProducts(products.filter((product) => product.id !== id));
  return current;
}

async function writeJsonProducts(products: ConsepotProduct[]) {
  const parsed = productListSchema.parse(products);
  await mkdir(path.dirname(dataFilePath), { recursive: true });
  await writeFile(dataFilePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
}

async function replaceProductImages(product: ConsepotProduct) {
  const supabase = getSupabaseAdminClient();
  const { error: deleteError } = await supabase
    .from("shop_product_images")
    .delete()
    .eq("product_id", product.id);

  if (deleteError) {
    throw new Error(`Supabase 상품 이미지 삭제 실패: ${deleteError.message}`);
  }

  const rows = product.images.map((image, index) => ({
    alt: image.alt,
    cafe24_image_path: image.cafe24ImagePath ?? null,
    is_primary: image.isPrimary ?? index === 0,
    placeholder_label: image.placeholderLabel ?? null,
    product_id: product.id,
    sort_order: index,
    src: image.src ?? null,
  }));

  if (rows.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from("shop_product_images")
    .insert(rows);

  if (insertError) {
    throw new Error(`Supabase 상품 이미지 저장 실패: ${insertError.message}`);
  }
}

async function upsertCafe24Mapping(
  productId: string,
  cafe24: Cafe24ProductMapping,
) {
  const supabase = getSupabaseAdminClient();
  const row = toSupabaseCafe24MappingRow(productId, cafe24);
  const { error } = await supabase
    .from("shop_product_cafe24_mappings")
    .upsert(row, { onConflict: "product_id" });

  if (error) {
    throw new Error(`Supabase Cafe24 매핑 저장 실패: ${error.message}`);
  }
}

function fromSupabaseRow(row: ProductSelectRow): ConsepotProduct {
  const mapping = normalizeMappingRow(row.shop_product_cafe24_mappings);
  const images = [...(row.shop_product_images ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  return productSchema.parse({
    cafe24: {
      categoryNo: mapping?.category_no ?? getDefaultCategoryNo(),
      checkoutUrl: mapping?.checkout_url ?? undefined,
      displayGroup: mapping?.display_group ?? getDefaultDisplayGroup(),
      lastSyncError: mapping?.last_sync_error ?? undefined,
      lastSyncedAt: mapping?.last_synced_at ?? undefined,
      mappingStatus: mapping?.mapping_status ?? "pending",
      productNo: mapping?.product_no ?? null,
      productUrl: mapping?.product_url ?? undefined,
      variantCode: mapping?.variant_code ?? undefined,
    },
    careNote: row.care_note ?? undefined,
    category: row.category,
    commerce: {
      availabilityStatus: row.availability_status,
      currency: row.currency,
      price: row.price_krw,
      source: "cafe24",
      stockQuantity: row.stock_quantity,
      syncedAt: mapping?.last_synced_at ?? undefined,
    },
    createdAt: row.created_at,
    glaze: row.glaze ?? undefined,
    id: row.id,
    images: images.map((image) => ({
      alt: image.alt,
      cafe24ImagePath: image.cafe24_image_path ?? undefined,
      isPrimary: image.is_primary,
      placeholderLabel: image.placeholder_label ?? undefined,
      src: image.src ?? undefined,
    })),
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
    story: row.story ?? undefined,
    titleKo: row.title_ko,
    updatedAt: row.updated_at,
    usageNote: row.usage_note ?? undefined,
  });
}

function fromSupabaseSyncLogRow(row: ProductSyncLogRow): ProductSyncLog {
  return {
    action: row.action,
    createdAt: row.created_at,
    id: row.id,
    message: row.message,
    productId: row.product_id,
    provider: row.provider,
    requestPayload: row.request_payload,
    responsePayload: row.response_payload,
    status: row.status,
  };
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
    title_ko: product.titleKo,
    updated_at: product.updatedAt,
    usage_note: product.usageNote ?? null,
  };
}

function toSupabaseCafe24MappingRow(
  productId: string,
  cafe24: Cafe24ProductMapping,
) {
  return {
    category_no: cafe24.categoryNo ?? null,
    checkout_url: cafe24.checkoutUrl ?? null,
    display_group: cafe24.displayGroup ?? getDefaultDisplayGroup(),
    last_sync_error: cafe24.lastSyncError ?? null,
    last_synced_at: cafe24.lastSyncedAt ?? null,
    mapping_status: cafe24.mappingStatus,
    product_id: productId,
    product_no: cafe24.productNo,
    product_url: cafe24.productUrl ?? null,
    variant_code: cafe24.variantCode ?? null,
  };
}

function normalizeMappingRow(
  value: Cafe24MappingRow | Cafe24MappingRow[] | null | undefined,
) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function getSeedProducts(): ConsepotProduct[] {
  return productCatalog.map((product) => ({
    ...product,
    cafe24: cafe24ProductMap[product.slug] ?? {
      categoryNo: getDefaultCategoryNo(),
      displayGroup: getDefaultDisplayGroup(),
      mappingStatus: "pending",
      productNo: null,
    },
  }));
}

function getDefaultCategoryNo() {
  const value = process.env.CAFE24_DEFAULT_CATEGORY_NO;
  return value ? Number(value) : 29;
}

function getDefaultDisplayGroup() {
  const value = process.env.CAFE24_DEFAULT_DISPLAY_GROUP;
  return value ? Number(value) : 1;
}

function emptyToUndefined(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isMissingFileError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
