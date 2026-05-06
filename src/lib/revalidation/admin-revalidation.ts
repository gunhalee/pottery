import "server-only";

import { revalidatePath } from "next/cache";
import type { ContentKind } from "@/lib/content-manager/content-model";
import {
  getContentAdminPath,
  getContentPublicPath,
} from "@/lib/content-manager/content-store";

export function revalidateProductSurfaces(slug: string, previousSlug?: string) {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath(`/shop/${slug}`);
  revalidatePath("/gallery");
  revalidatePath("/admin/products");

  if (previousSlug && previousSlug !== slug) {
    revalidatePath(`/shop/${previousSlug}`);
  }
}

export function revalidateDeletedProductSurfaces(slug: string) {
  revalidateProductSurfaces(slug);
}

export function revalidateContentSurfaces({
  id,
  kind,
  previousRelatedProductSlug,
  previousSlug,
  relatedProductSlug,
  slug,
}: {
  id: string;
  kind: ContentKind;
  previousRelatedProductSlug?: string | null;
  previousSlug?: string;
  relatedProductSlug?: string | null;
  slug: string;
}) {
  const adminPath = getContentAdminPath(kind);
  const publicPath = getContentPublicPath(kind);

  revalidatePath("/");
  revalidatePath(adminPath);
  revalidatePath(`${adminPath}/${id}`);
  revalidatePath(`${adminPath}/${id}/preview`);
  revalidatePath(publicPath);
  revalidatePath(`${publicPath}/${slug}`);

  if (kind === "gallery") {
    revalidatePath("/shop");
  }

  if (previousSlug && previousSlug !== slug) {
    revalidatePath(`${publicPath}/${previousSlug}`);
  }

  if (relatedProductSlug) {
    revalidatePath(`/shop/${relatedProductSlug}`);
  }

  if (
    previousRelatedProductSlug &&
    previousRelatedProductSlug !== relatedProductSlug
  ) {
    revalidatePath(`/shop/${previousRelatedProductSlug}`);
  }
}
