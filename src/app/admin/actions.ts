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
  createProductDraft,
  getProductById,
  normalizeSlug,
  updateProduct,
  updateProductCafe24Mapping,
} from "@/lib/shop";
import { syncProductToCafe24 } from "@/lib/cafe24/product-sync";

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
  redirect(`/admin/products/${product.id}?created=1`);
}

export async function updateProductAction(formData: FormData) {
  await assertAdmin();

  const parsed = productUpdateSchema.parse({
    availabilityStatus: formData.get("availabilityStatus"),
    careNote: formData.get("careNote"),
    category: formData.get("category"),
    glaze: formData.get("glaze"),
    id: formData.get("id"),
    isArchived: formData.get("isArchived") === "on",
    isLimited: formData.get("isLimited") === "on",
    kind: formData.get("kind"),
    limitedType: nullableSelectValue(formData.get("limitedType")),
    material: formData.get("material"),
    price: nullableIntegerValue(formData.get("price")),
    published: formData.get("published") === "on",
    restockCtaType: nullableSelectValue(formData.get("restockCtaType")),
    shippingNote: formData.get("shippingNote"),
    shortDescription: formData.get("shortDescription"),
    size: formData.get("size"),
    slug: normalizeSlug(String(formData.get("slug") ?? "")),
    stockQuantity: nullableIntegerValue(formData.get("stockQuantity")),
    story: formData.get("story"),
    titleKo: formData.get("titleKo"),
    usageNote: formData.get("usageNote"),
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
    const cafe24 = await syncProductToCafe24(product);
    const updated = await updateProductCafe24Mapping(product.id, cafe24);

    revalidateProductPaths(updated?.slug ?? product.slug);
    redirect(`/admin/products/${product.id}?synced=1`);
  } catch (error) {
    const message = getErrorMessage(error);
    await updateProductCafe24Mapping(product.id, {
      ...product.cafe24,
      lastSyncError: message,
      mappingStatus: "sync_failed",
    });

    revalidatePath("/admin/products");
    redirect(
      `/admin/products/${product.id}?sync_error=${encodeURIComponent(message)}`,
    );
  }
}

function revalidateProductPaths(slug: string, previousSlug?: string) {
  revalidatePath("/shop");
  revalidatePath(`/shop/${slug}`);

  if (previousSlug && previousSlug !== slug) {
    revalidatePath(`/shop/${previousSlug}`);
  }

  revalidatePath("/admin/products");
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
