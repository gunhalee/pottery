"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assertAdmin,
  clearAdminSessionCookie,
  setAdminSessionCookie,
  verifyAdminPassword,
} from "@/lib/admin/auth";
import type {
  ContentPublishErrorCode,
  ProductPublishErrorCode,
} from "@/lib/admin/publish-errors";
import {
  createProductDraft,
  deleteProduct,
  getProductById,
  normalizeSlug,
  updateProduct,
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
  revalidateContentSurfaces,
  revalidateDeletedProductSurfaces,
  revalidateProductSurfaces,
} from "@/lib/revalidation/admin-revalidation";
import {
  findMissingMediaVariantRequirements,
  regenerateMediaAssetVariants,
} from "@/lib/media/media-maintenance";
import {
  getContentImageVariantRequirements,
  getProductImageVariantRequirements,
} from "@/lib/media/media-role-requirements";
import { consumeRateLimit, getClientIp } from "@/lib/security/rate-limit";

const draftSchema = z.object({
  slug: z.string(),
  titleKo: z.string().min(1),
});

const productImageUpdateSchema = z.object({
  alt: z.string(),
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
  madeToOrderAvailable: z.boolean(),
  madeToOrderDaysMax: z.number().int().positive(),
  madeToOrderDaysMin: z.number().int().positive(),
  madeToOrderNotice: z.string().optional(),
  material: z.string().optional(),
  plantCareNotice: z.string().optional(),
  plantOptionEnabled: z.boolean(),
  plantOptionPriceDelta: z.number().int().nonnegative(),
  plantReturnNotice: z.string().optional(),
  plantShippingRestrictionNotice: z.string().optional(),
  plantSpecies: z.string().optional(),
  price: z.number().int().nonnegative().nullable(),
  purchaseLimitQuantity: z.number().int().nonnegative().nullable(),
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

const adminLoginRateLimit = {
  limit: 5,
  windowMs: 10 * 60 * 1000,
};

export async function loginAdminAction(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "/admin/products"));
  const requestHeaders = await headers();
  const rateLimit = await consumeRateLimit({
    key: getClientIp(requestHeaders),
    limit: adminLoginRateLimit.limit,
    namespace: "admin-login",
    windowMs: adminLoginRateLimit.windowMs,
  });

  if (!rateLimit.allowed) {
    redirect(`/admin/login?rate_limit=1&next=${encodeURIComponent(next)}`);
  }

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
  const kind = z.enum(["gallery", "news"]).parse(formData.get("kind"));
  const id = stringValue(formData.get("id"));
  const adminPath = getContentAdminPath(kind);
  const displayDate = normalizeContentDisplayDateForSave(
    kind,
    stringValue(formData.get("displayDate")),
  );

  if (displayDate.error) {
    redirect(`${adminPath}/${id}?date_error=${displayDate.error}`);
  }

  const parsed = contentUpdateSchema.parse({
    body,
    displayDate: displayDate.value,
    id,
    images: z.array(contentImageUpdateSchema).parse(
      parseJsonField(formData.get("imagesJson")),
    ),
    kind,
    relatedProductSlug: nullableStringValue(formData.get("relatedProductSlug")),
    slug: normalizeContentSlug(String(formData.get("slug") ?? "")),
    status: formData.get("status"),
    summary: stringValue(formData.get("summary")),
    title: stringValue(formData.get("title")),
  });

  const beforeUpdate = await getContentEntryById(parsed.id);

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

  const kind = z.enum(["gallery", "news"]).parse(formData.get("kind"));
  const entryId = stringValue(formData.get("entryId"));
  const parsed = contentImageDeleteSchema.parse({
    entryId,
    imageId: stringValue(formData.get("imageId")),
    kind,
  });
  const adminPath = getContentAdminPath(parsed.kind);
  const entry = await getContentEntryById(parsed.entryId);

  if (!entry || entry.kind !== parsed.kind) {
    redirect(`${adminPath}?missing=1`);
  }

  const displayDate = normalizeContentDisplayDateForSave(
    parsed.kind,
    stringValue(formData.get("displayDate")),
  );

  if (displayDate.error) {
    redirect(`${adminPath}/${parsed.entryId}?date_error=${displayDate.error}`);
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
    displayDate: displayDate.value,
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
    console.error("[admin-media-variant-regenerate]", {
      assetId: parsed.assetId,
      error,
    });
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
    madeToOrderAvailable: formData.get("madeToOrderAvailable") === "on",
    madeToOrderDaysMax:
      nullableIntegerValue(formData.get("madeToOrderDaysMax")) ?? 45,
    madeToOrderDaysMin:
      nullableIntegerValue(formData.get("madeToOrderDaysMin")) ?? 30,
    madeToOrderNotice: stringValue(formData.get("madeToOrderNotice")),
    material: stringValue(formData.get("material")),
    plantCareNotice: stringValue(formData.get("plantCareNotice")),
    plantOptionEnabled: formData.get("plantOptionEnabled") === "on",
    plantOptionPriceDelta:
      nullableIntegerValue(formData.get("plantOptionPriceDelta")) ?? 0,
    plantReturnNotice: stringValue(formData.get("plantReturnNotice")),
    plantShippingRestrictionNotice: stringValue(
      formData.get("plantShippingRestrictionNotice"),
    ),
    plantSpecies: stringValue(formData.get("plantSpecies")),
    price: nullableIntegerValue(formData.get("price")),
    purchaseLimitQuantity: nullableIntegerValue(
      formData.get("purchaseLimitQuantity"),
    ),
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

async function getContentPublishError(
  input: z.infer<typeof contentUpdateSchema>,
): Promise<ContentPublishErrorCode | null> {
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
    input.images.flatMap((image) =>
      getContentImageVariantRequirements(image, bodyImageIds.has(image.id)),
    ),
  );

  if (missingVariants.length > 0) {
    return "variant";
  }

  return null;
}

async function getProductPublishError(
  input: z.infer<typeof productUpdateSchema>,
): Promise<ProductPublishErrorCode | null> {
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
    input.images.flatMap((image) => getProductImageVariantRequirements(image)),
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

function normalizeContentDisplayDateForSave(
  kind: ContentKind,
  value: string,
): { error?: "incomplete" | "invalid"; value: string } {
  const trimmed = value.trim();

  if (!trimmed || kind !== "news") {
    return { value: trimmed };
  }

  const parts = trimmed.match(/\d+/g) ?? [];

  if (parts.length < 3 || !/^\d{4}$/.test(parts[0] ?? "")) {
    return { error: "incomplete", value: trimmed };
  }

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { error: "invalid", value: trimmed };
  }

  return {
    value: `${String(year).padStart(4, "0")}. ${String(month).padStart(2, "0")}. ${String(day).padStart(2, "0")}.`,
  };
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
