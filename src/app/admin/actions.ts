"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assertAdmin,
  clearAdminSessionCookie,
  setAdminSessionCookie,
  verifyAdminPassword,
} from "@/lib/admin/auth";
import {
  appendProductSyncLog,
  createProductDraft,
  deleteProduct,
  getProductById,
  normalizeSlug,
  updateProduct,
  updateProductCafe24Mapping,
  type Cafe24ProductMapping,
} from "@/lib/shop";
import {
  createContentDraft,
  deleteContentEntry,
  deleteContentImage,
  getContentAdminPath,
  getContentEntryById,
  normalizeContentSlug,
  updateContentEntry,
} from "@/lib/content-manager/content-store";
import type {
  ContentImageLayout,
  ContentKind,
} from "@/lib/content-manager/content-model";
import {
  extractPlainTextFromLexicalJson,
  removeContentImageNodeFromLexicalJson,
  walkLexicalNodes,
} from "@/lib/content-manager/rich-text-utils";
import {
  buildCafe24SyncRequestSnapshot,
  syncProductToCafe24,
} from "@/lib/cafe24/product-sync";
import {
  revalidateContentSurfaces,
  revalidateDeletedProductSurfaces,
  revalidateProductSurfaces,
} from "@/lib/revalidation/admin-revalidation";
import {
  findMissingMediaVariantRequirements,
  regenerateMediaAssetVariants,
  type MediaVariantRequirement,
} from "@/lib/media/media-maintenance";

const draftSchema = z.object({
  slug: z.string(),
  titleKo: z.string().min(1),
});

const productImageUpdateSchema = z.object({
  alt: z.string(),
  cafe24ImagePath: z.string().optional(),
  caption: z.string().optional(),
  height: z.number().int().positive().optional(),
  id: z.string().optional(),
  isDescription: z.boolean().optional(),
  isDetail: z.boolean().optional(),
  isListImage: z.boolean().optional(),
  isPrimary: z.boolean(),
  placeholderLabel: z.string().optional(),
  src: z.string().optional(),
  storagePath: z.string().optional(),
  width: z.number().int().positive().optional(),
});

const productUpdateSchema = z.object({
  availabilityStatus: z.enum(["available", "sold_out", "upcoming", "archive"]),
  careNote: z.string().optional(),
  category: z.string().min(1),
  glaze: z.string().optional(),
  id: z.string().min(1),
  images: z.array(productImageUpdateSchema),
  isArchived: z.boolean(),
  isLimited: z.boolean(),
  kind: z.enum(["regular", "one_of_a_kind"]),
  limitedType: z
    .enum(["quantity", "period", "kiln_batch", "project"])
    .nullable(),
  material: z.string().optional(),
  price: z.number().int().nonnegative().nullable(),
  published: z.boolean(),
  restockCtaType: z
    .enum(["restock_alert", "similar_work_alert", "next_limited_alert"])
    .nullable(),
  shippingNote: z.string().optional(),
  shortDescription: z.string().min(1),
  size: z.string().optional(),
  slug: z.string().min(1),
  stockQuantity: z.number().int().nonnegative().nullable(),
  story: z.string().optional(),
  titleKo: z.string().min(1),
  usageNote: z.string().optional(),
});

const cafe24MappingSchema = z.object({
  categoryNo: z.number().int().positive().nullable(),
  checkoutUrl: z.string().nullable(),
  displayGroup: z.number().int().positive().nullable(),
  id: z.string().min(1),
  productNo: z.string().nullable(),
  productUrl: z.string().nullable(),
  variantCode: z.string().nullable(),
});

const productDeleteSchema = z.object({
  confirmSlug: z.string().min(1),
  id: z.string().min(1),
});

const contentDraftSchema = z.object({
  kind: z.enum(["gallery", "news"]),
  slug: z.string().optional(),
  title: z.string().min(1),
});

const contentImageUpdateSchema = z.object({
  alt: z.string(),
  caption: z.string().optional(),
  id: z.string().min(1),
  isCover: z.boolean(),
  isDetail: z.boolean(),
  isListImage: z.boolean(),
  isReserved: z.boolean(),
  layout: z.enum([
    "align-left",
    "align-right",
    "default",
    "full",
    "two-column",
    "wide",
  ]),
  sortOrder: z.number().int().nonnegative(),
});

const contentUpdateSchema = z.object({
  body: z.unknown(),
  displayDate: z.string().optional(),
  id: z.string().min(1),
  images: z.array(contentImageUpdateSchema),
  kind: z.enum(["gallery", "news"]),
  relatedProductSlug: z.string().nullable(),
  slug: z.string().min(1),
  status: z.enum(["draft", "published"]),
  summary: z.string(),
  title: z.string().min(1),
});

const contentDeleteSchema = z.object({
  confirmSlug: z.string().min(1),
  id: z.string().min(1),
  kind: z.enum(["gallery", "news"]),
});

const contentImageDeleteSchema = z.object({
  entryId: z.string().min(1),
  imageId: z.string().min(1),
  kind: z.enum(["gallery", "news"]),
});

const mediaAssetActionSchema = z.object({
  assetId: z.string().min(1),
  returnTo: z.string().optional(),
});

export async function loginAdminAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "/admin/products"));

  if (!verifyAdminPassword(password)) {
    redirect(`/admin/login?error=1&next=${encodeURIComponent(next)}`);
  }

  await setAdminSessionCookie();
  redirect(next);
}

export async function logoutAdminAction() {
  await clearAdminSessionCookie();
  redirect("/admin/login");
}

export async function createProductDraftAction(formData: FormData) {
  await assertAdmin();

  const parsed = draftSchema.parse({
    slug: normalizeSlug(String(formData.get("slug") ?? "")),
    titleKo: String(formData.get("titleKo") ?? "").trim(),
  });

  const product = await createProductDraft(parsed);

  revalidateProductSurfaces(product.slug);
  redirect(`/admin/products/${product.id}?created=1`);
}

export async function createContentDraftAction(formData: FormData) {
  await assertAdmin();

  const parsed = contentDraftSchema.parse({
    kind: formData.get("kind"),
    slug: normalizeContentSlug(String(formData.get("slug") ?? "")),
    title: stringValue(formData.get("title")),
  });

  const adminPath = getContentAdminPath(parsed.kind);

  try {
    const entry = await createContentDraft({
      ...parsed,
      slug: parsed.slug ?? "",
    });

    revalidateContentPaths(entry.kind, entry.id, entry.slug);
    redirect(`${adminPath}/${entry.id}?created=1`);
  } catch (error) {
    if (isDuplicateSlugError(error)) {
      redirect(`${adminPath}?slug_error=duplicate`);
    }

    throw error;
  }
}

export async function updateContentEntryAction(formData: FormData) {
  await assertAdmin();

  const body = parseJsonField(formData.get("bodyJson"));
  const parsed = contentUpdateSchema.parse({
    body,
    displayDate: stringValue(formData.get("displayDate")),
    id: stringValue(formData.get("id")),
    images: z.array(contentImageUpdateSchema).parse(
      parseJsonField(formData.get("imagesJson")),
    ),
    kind: formData.get("kind"),
    relatedProductSlug: nullableStringValue(formData.get("relatedProductSlug")),
    slug: normalizeContentSlug(String(formData.get("slug") ?? "")),
    status: formData.get("status"),
    summary: stringValue(formData.get("summary")),
    title: stringValue(formData.get("title")),
  });

  const beforeUpdate = await getContentEntryById(parsed.id);
  const adminPath = getContentAdminPath(parsed.kind);

  if (!beforeUpdate || beforeUpdate.kind !== parsed.kind) {
    redirect(`${adminPath}?missing=1`);
  }

  const publishError = await getContentPublishError(parsed);

  if (publishError) {
    redirect(`${adminPath}/${parsed.id}?publish_error=${publishError}`);
  }

  try {
    const updated = await updateContentEntry(parsed.id, {
      ...parsed,
      bodyText: extractPlainTextFromLexicalJson(body),
      images: parsed.images.map((image) => ({
        ...image,
        layout: image.layout as ContentImageLayout,
      })),
    });

    revalidateContentPaths(
      updated.kind,
      updated.id,
      updated.slug,
      beforeUpdate.slug,
      updated.relatedProductSlug,
      beforeUpdate.relatedProductSlug,
    );
    redirect(`${adminPath}/${updated.id}?saved=1`);
  } catch (error) {
    if (isDuplicateSlugError(error)) {
      redirect(`${adminPath}/${parsed.id}?slug_error=duplicate`);
    }

    throw error;
  }
}

export async function deleteContentEntryAction(formData: FormData) {
  await assertAdmin();

  const parsed = contentDeleteSchema.parse({
    confirmSlug: stringValue(formData.get("confirmSlug")),
    id: stringValue(formData.get("id")),
    kind: formData.get("kind"),
  });
  const adminPath = getContentAdminPath(parsed.kind);
  const entry = await getContentEntryById(parsed.id);

  if (!entry || entry.kind !== parsed.kind) {
    redirect(`${adminPath}?missing=1`);
  }

  if (parsed.confirmSlug !== entry.slug) {
    redirect(`${adminPath}/${entry.id}?delete_error=confirm`);
  }

  const deleted = await deleteContentEntry(entry.id);
  revalidateContentPaths(
    deleted.kind,
    deleted.id,
    deleted.slug,
    deleted.slug,
    deleted.relatedProductSlug,
    deleted.relatedProductSlug,
  );
  redirect(`${adminPath}?deleted=1`);
}

export async function deleteContentImageAction(formData: FormData) {
  await assertAdmin();

  const parsed = contentImageDeleteSchema.parse({
    entryId: stringValue(formData.get("entryId")),
    imageId: stringValue(formData.get("imageId")),
    kind: formData.get("kind"),
  });
  const adminPath = getContentAdminPath(parsed.kind);
  const entry = await getContentEntryById(parsed.entryId);

  if (!entry || entry.kind !== parsed.kind) {
    redirect(`${adminPath}?missing=1`);
  }

  const body = removeContentImageNodeFromLexicalJson(
    parseJsonField(formData.get("bodyJson")) ?? entry.body,
    parsed.imageId,
  );
  const images = z
    .array(contentImageUpdateSchema)
    .parse(parseJsonField(formData.get("imagesJson")))
    .filter((image) => image.id !== parsed.imageId);

  const updated = await updateContentEntry(entry.id, {
    body,
    bodyText: extractPlainTextFromLexicalJson(body),
    displayDate: stringValue(formData.get("displayDate")),
    images: images.map((image) => ({
      ...image,
      layout: image.layout as ContentImageLayout,
    })),
    relatedProductSlug: nullableStringValue(formData.get("relatedProductSlug")),
    slug: normalizeContentSlug(String(formData.get("slug") ?? "")),
    status: z
      .enum(["draft", "published"])
      .parse(String(formData.get("status") ?? entry.status)),
    summary: stringValue(formData.get("summary")),
    title: stringValue(formData.get("title")),
  });
  await deleteContentImage(parsed.entryId, parsed.imageId);
  revalidateContentPaths(
    updated.kind,
    updated.id,
    updated.slug,
    entry.slug,
    updated.relatedProductSlug,
    entry.relatedProductSlug,
  );
  redirect(`${adminPath}/${parsed.entryId}?image_deleted=1`);
}

export async function updateProductAction(formData: FormData) {
  await assertAdmin();

  const parsed = parseProductUpdateFormData(formData);

  const beforeUpdate = await getProductById(parsed.id);

  const publishError = await getProductPublishError(parsed);

  if (publishError) {
    redirect(`/admin/products/${parsed.id}?publish_error=${publishError}`);
  }

  const updated = await updateProduct(parsed.id, parsed);

  if (!updated) {
    redirect("/admin/products?missing=1");
  }

  revalidateProductPaths(updated.slug, beforeUpdate?.slug);
  redirect(`/admin/products/${updated.id}?saved=1`);
}

export async function deleteProductImageAction(formData: FormData) {
  await assertAdmin();

  const parsed = parseProductUpdateFormData(formData);
  const imageId = stringValue(formData.get("imageId"));
  const beforeUpdate = await getProductById(parsed.id);

  if (!beforeUpdate || !imageId) {
    redirect("/admin/products?missing=1");
  }

  const submittedImage = parsed.images.find((image) => image.id === imageId);
  const savedImage = beforeUpdate.images.find((image) => image.id === imageId);
  const targetImage = submittedImage ?? savedImage;

  if (!targetImage) {
    redirect(`/admin/products/${beforeUpdate.id}?image_delete_error=missing`);
  }

  const updated = await updateProduct(parsed.id, {
    ...parsed,
    images: parsed.images.filter((image) => image.id !== imageId),
  });

  if (!updated) {
    redirect("/admin/products?missing=1");
  }

  revalidateProductPaths(updated.slug, beforeUpdate.slug);
  redirect(`/admin/products/${updated.id}?image_deleted=1`);
}

export async function regenerateMediaAssetVariantsAction(formData: FormData) {
  await assertAdmin();

  const parsed = mediaAssetActionSchema.parse({
    assetId: stringValue(formData.get("assetId")),
    returnTo: safeNextPath(String(formData.get("returnTo") ?? "/admin/media")),
  });
  let target = "";

  try {
    await regenerateMediaAssetVariants(parsed.assetId);
    revalidatePath("/admin/media");
    revalidatePath("/admin/ops");
    target = withQuery(parsed.returnTo ?? "/admin/media", "regenerated", "1");
  } catch (error) {
    target = withQuery(
      parsed.returnTo ?? "/admin/media",
      "regenerate_error",
      getErrorMessage(error),
    );
  }

  redirect(target);
}

export async function redirectToProductEditorAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const product = await getProductById(id);

  if (!product) {
    redirect("/admin/products?missing=1");
  }

  redirect(`/admin/products/${product.id}`);
}

export async function syncProductToCafe24Action(formData: FormData) {
  await assertAdmin();

  const id = String(formData.get("id") ?? "");
  const product = await getProductById(id);

  if (!product) {
    redirect("/admin/products?missing=1");
  }

  try {
    const requestSnapshot = await buildCafe24SyncRequestSnapshot(product);
    const cafe24 = await syncProductToCafe24(product);
    const updated = await updateProductCafe24Mapping(product.id, cafe24);

    await appendProductSyncLog({
      action: "sync",
      message: "Cafe24 상품 동기화를 완료했습니다.",
      productId: product.id,
      requestPayload: requestSnapshot,
      responsePayload: cafe24,
      status: "success",
    });

    revalidateProductPaths(updated?.slug ?? product.slug);
  } catch (error) {
    const message = getErrorMessage(error);

    await updateProductCafe24Mapping(product.id, {
      ...product.cafe24,
      lastSyncError: message,
      mappingStatus: "sync_failed",
    });

    await appendProductSyncLog({
      action: "sync",
      message,
      productId: product.id,
      requestPayload: await buildCafe24SyncRequestSnapshot(product),
      status: "failed",
    });

    revalidateProductSurfaces(product.slug);
    redirect(
      `/admin/products/${product.id}?sync_error=${encodeURIComponent(message)}`,
    );
  }

  redirect(`/admin/products/${product.id}?synced=1`);
}

export async function saveCafe24MappingAction(formData: FormData) {
  await assertAdmin();

  const parsed = cafe24MappingSchema.parse({
    categoryNo: nullableIntegerValue(formData.get("categoryNo")),
    checkoutUrl: nullableStringValue(formData.get("checkoutUrl")),
    displayGroup: nullableIntegerValue(formData.get("displayGroup")),
    id: stringValue(formData.get("id")),
    productNo: nullableStringValue(formData.get("productNo")),
    productUrl: nullableStringValue(formData.get("productUrl")),
    variantCode: nullableStringValue(formData.get("variantCode")),
  });

  const product = await getProductById(parsed.id);

  if (!product) {
    redirect("/admin/products?missing=1");
  }

  const cafe24: Cafe24ProductMapping = {
    ...product.cafe24,
    categoryNo: parsed.categoryNo ?? undefined,
    checkoutUrl: parsed.checkoutUrl ?? undefined,
    displayGroup: parsed.displayGroup ?? undefined,
    lastSyncError: undefined,
    mappingStatus:
      parsed.checkoutUrl || parsed.productNo || parsed.productUrl
        ? "mapped"
        : "pending",
    productNo: parsed.productNo,
    productUrl: parsed.productUrl ?? undefined,
    variantCode: parsed.variantCode ?? undefined,
  };

  const updated = await updateProductCafe24Mapping(product.id, cafe24);

  await appendProductSyncLog({
    action: "manual_mapping",
    message: "Cafe24 매핑 정보를 수동 저장했습니다.",
    productId: product.id,
    requestPayload: cafe24,
    status: "success",
  });

  revalidateProductPaths(updated?.slug ?? product.slug);
  redirect(`/admin/products/${product.id}?mapping_saved=1`);
}

export async function deleteProductAction(formData: FormData) {
  await assertAdmin();

  const parsed = productDeleteSchema.parse({
    confirmSlug: stringValue(formData.get("confirmSlug")),
    id: stringValue(formData.get("id")),
  });

  const product = await getProductById(parsed.id);

  if (!product) {
    redirect("/admin/products?missing=1");
  }

  if (parsed.confirmSlug !== product.slug) {
    redirect(`/admin/products/${product.id}?delete_error=confirm`);
  }

  const deleted = await deleteProduct(product.id);

  revalidateDeletedProductSurfaces(deleted.slug);
  redirect("/admin/products?deleted=1");
}

function revalidateProductPaths(slug: string, previousSlug?: string) {
  revalidateProductSurfaces(slug, previousSlug);
}

function parseProductUpdateFormData(formData: FormData) {
  return productUpdateSchema.parse({
    availabilityStatus: formData.get("availabilityStatus"),
    careNote: stringValue(formData.get("careNote")),
    category: stringValue(formData.get("category")),
    glaze: stringValue(formData.get("glaze")),
    id: stringValue(formData.get("id")),
    images: z
      .array(productImageUpdateSchema)
      .parse(parseJsonField(formData.get("imagesJson")) ?? []),
    isArchived: formData.get("isArchived") === "on",
    isLimited: formData.get("isLimited") === "on",
    kind: formData.get("kind"),
    limitedType: nullableSelectValue(formData.get("limitedType")),
    material: stringValue(formData.get("material")),
    price: nullableIntegerValue(formData.get("price")),
    published: formData.get("published") === "on",
    restockCtaType: nullableSelectValue(formData.get("restockCtaType")),
    shippingNote: stringValue(formData.get("shippingNote")),
    shortDescription: stringValue(formData.get("shortDescription")),
    size: stringValue(formData.get("size")),
    slug: normalizeSlug(String(formData.get("slug") ?? "")),
    stockQuantity: nullableIntegerValue(formData.get("stockQuantity")),
    story: stringValue(formData.get("story")),
    titleKo: stringValue(formData.get("titleKo")),
    usageNote: stringValue(formData.get("usageNote")),
  });
}

async function getContentPublishError(input: z.infer<typeof contentUpdateSchema>) {
  if (input.status !== "published") {
    return null;
  }

  if (!input.title.trim()) {
    return "title";
  }

  if (!input.slug.trim()) {
    return "slug";
  }

  if (!input.images.some((image) => image.isCover)) {
    return "cover";
  }

  if (!input.images.some((image) => image.isListImage)) {
    return "list";
  }

  const bodyImageIds = new Set(
    walkLexicalNodes(input.body)
      .filter((node) => node.type === "content-image")
      .map((node) => node.id)
      .filter((id): id is string => typeof id === "string"),
  );
  const submittedImageIds = new Set(input.images.map((image) => image.id));

  if ([...bodyImageIds].some((imageId) => !submittedImageIds.has(imageId))) {
    return "body-image";
  }

  const missingVariants = await findMissingMediaVariantRequirements(
    input.images.flatMap((image): MediaVariantRequirement[] => {
      const requirements: MediaVariantRequirement[] = [];

      if (image.isCover || image.isDetail || bodyImageIds.has(image.id)) {
        requirements.push({
          assetId: image.id,
          label: image.alt || image.id,
          surface: "detail",
        });
      }

      if (image.isListImage) {
        requirements.push({
          assetId: image.id,
          label: image.alt || image.id,
          surface: "list",
        });
      }

      return requirements;
    }),
  );

  if (missingVariants.length > 0) {
    return "variant";
  }

  return null;
}

async function getProductPublishError(input: z.infer<typeof productUpdateSchema>) {
  if (!input.published) {
    return null;
  }

  if (!input.titleKo.trim()) {
    return "title";
  }

  if (!input.slug.trim()) {
    return "slug";
  }

  if (!input.images.some((image) => image.isPrimary)) {
    return "cover";
  }

  if (!input.images.some((image) => image.isListImage)) {
    return "list";
  }

  if (
    input.availabilityStatus === "available" &&
    (input.price === null || input.price < 0)
  ) {
    return "price";
  }

  const missingVariants = await findMissingMediaVariantRequirements(
    input.images.flatMap((image): MediaVariantRequirement[] => {
      if (!image.id) {
        return [];
      }

      const requirements: MediaVariantRequirement[] = [];

      if (image.isPrimary || image.isDetail || image.isDescription) {
        requirements.push({
          assetId: image.id,
          label: image.alt || image.id,
          surface: "detail",
        });
      }

      if (image.isListImage) {
        requirements.push({
          assetId: image.id,
          label: image.alt || image.id,
          surface: "list",
        });
      }

      return requirements;
    }),
  );

  if (missingVariants.length > 0) {
    return "variant";
  }

  return null;
}

function revalidateContentPaths(
  kind: ContentKind,
  id: string,
  slug: string,
  previousSlug?: string,
  relatedProductSlug?: string | null,
  previousRelatedProductSlug?: string | null,
) {
  revalidateContentSurfaces({
    id,
    kind,
    previousRelatedProductSlug,
    previousSlug,
    relatedProductSlug,
    slug,
  });
}

function parseJsonField(value: FormDataEntryValue | null) {
  const raw = String(value ?? "");

  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as unknown;
}

function isDuplicateSlugError(error: unknown) {
  return error instanceof Error && error.message.includes("slug");
}

function nullableIntegerValue(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function nullableSelectValue(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  return raw ? raw : null;
}

function nullableStringValue(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  return raw ? raw : null;
}

function stringValue(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function safeNextPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/admin/products";
  }

  return value;
}

function withQuery(path: string, key: string, value: string) {
  const [pathname, hash = ""] = path.split("#");
  const separator = pathname.includes("?") ? "&" : "?";
  const suffix = hash ? `#${hash}` : "";

  return `${pathname}${separator}${key}=${encodeURIComponent(value)}${suffix}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "알 수 없는 오류가 발생했습니다.";
}
