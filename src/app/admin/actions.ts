"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  buildCafe24SyncRequestSnapshot,
  syncProductToCafe24,
} from "@/lib/cafe24/product-sync";

const draftSchema = z.object({
  slug: z.string().min(1),
  titleKo: z.string().min(1),
});

const productUpdateSchema = z.object({
  availabilityStatus: z.enum(["available", "sold_out", "upcoming", "archive"]),
  careNote: z.string().optional(),
  category: z.string().min(1),
  glaze: z.string().optional(),
  id: z.string().min(1),
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

  revalidatePath("/shop");
  revalidatePath("/admin/products");
  redirect(`/admin/products/${product.id}?created=1`);
}

export async function updateProductAction(formData: FormData) {
  await assertAdmin();

  const parsed = productUpdateSchema.parse({
    availabilityStatus: formData.get("availabilityStatus"),
    careNote: stringValue(formData.get("careNote")),
    category: stringValue(formData.get("category")),
    glaze: stringValue(formData.get("glaze")),
    id: stringValue(formData.get("id")),
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

  const beforeUpdate = await getProductById(parsed.id);
  const updated = await updateProduct(parsed.id, parsed);

  if (!updated) {
    redirect("/admin/products?missing=1");
  }

  revalidateProductPaths(updated.slug, beforeUpdate?.slug);
  redirect(`/admin/products/${updated.id}?saved=1`);
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

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${product.id}`);
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

  revalidatePath("/shop");
  revalidatePath(`/shop/${deleted.slug}`);
  revalidatePath("/admin/products");
  redirect("/admin/products?deleted=1");
}

function revalidateProductPaths(slug: string, previousSlug?: string) {
  revalidatePath("/shop");
  revalidatePath(`/shop/${slug}`);
  revalidatePath("/admin/products");

  if (previousSlug && previousSlug !== slug) {
    revalidatePath(`/shop/${previousSlug}`);
  }
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "알 수 없는 오류가 발생했습니다.";
}
