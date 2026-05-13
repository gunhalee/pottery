import type {
  ContentImage,
  ContentImageUpdateInput,
} from "@/lib/content-manager/content-model";
import type {
  MediaUsageRole,
} from "@/lib/media/media-model";
import type { MediaVariantSurface } from "@/lib/media/media-variant-policy";
import type { ProductImage } from "@/lib/shop/product-model";

export type RequiredMediaVariantSurface = Extract<
  MediaVariantSurface,
  "detail" | "list"
>;

export type MediaRoleVariantRequirement = {
  assetId: string;
  label: string;
  surface: RequiredMediaVariantSurface;
};

type ProductRoleImage = Pick<
  ProductImage,
  "alt" | "id" | "isDescription" | "isDetail" | "isListImage" | "isPrimary"
>;

type ContentRoleImage = Pick<
  ContentImage | ContentImageUpdateInput,
  "alt" | "id" | "isCover" | "isDetail" | "isListImage" | "isReserved"
>;

export function getProductImageRoleLabels(image: ProductRoleImage) {
  return [
    image.isPrimary ? "대표" : null,
    image.isListImage ? "목록" : null,
    image.isDetail ? "상세" : null,
    image.isDescription ? "설명" : null,
  ].filter(isPresent);
}

export function getProductImageUsageRoles(
  image: ProductRoleImage,
): MediaUsageRole[] {
  const hasExplicitRole = Boolean(
    image.isPrimary ||
      image.isListImage ||
      image.isDetail ||
      image.isDescription,
  );

  return uniqueRoles([
    image.isPrimary ? "cover" : null,
    image.isListImage ? "list" : null,
    image.isDetail || !hasExplicitRole ? "detail" : null,
    image.isDescription ? "description" : null,
  ]);
}

export function getProductImageRequiredVariantSurfaces(
  image: ProductRoleImage,
): RequiredMediaVariantSurface[] {
  return uniqueSurfaces([
    image.isPrimary || image.isDetail || image.isDescription ? "detail" : null,
    image.isListImage ? "list" : null,
  ]);
}

export function getProductImageVariantRequirements(
  image: ProductRoleImage,
): MediaRoleVariantRequirement[] {
  if (!image.id) {
    return [];
  }

  return getProductImageRequiredVariantSurfaces(image).map((surface) => ({
    assetId: image.id!,
    label: image.alt || image.id!,
    surface,
  }));
}

export function getContentImageRoleLabels(
  image: ContentRoleImage,
  imageInBody: boolean,
) {
  return [
    imageInBody ? "본문" : null,
    image.isCover ? "대표" : null,
    image.isListImage ? "목록" : null,
    image.isDetail ? "상세" : null,
    image.isReserved ? "보관" : null,
  ].filter(isPresent);
}

export function getContentImageUsageRoles(
  image: ContentRoleImage,
  imageInBody: boolean,
): MediaUsageRole[] {
  if (image.isReserved) {
    return [];
  }

  return uniqueRoles([
    image.isCover ? "cover" : null,
    image.isListImage ? "list" : null,
    image.isDetail ? "detail" : null,
    imageInBody ? "body" : null,
  ]);
}

export function getContentImageRequiredVariantSurfaces(
  image: ContentRoleImage,
  imageInBody: boolean,
): RequiredMediaVariantSurface[] {
  if (image.isReserved) {
    return [];
  }

  return uniqueSurfaces([
    imageInBody || image.isCover || image.isDetail ? "detail" : null,
    image.isListImage ? "list" : null,
  ]);
}

export function getContentImageVariantRequirements(
  image: ContentRoleImage,
  imageInBody: boolean,
): MediaRoleVariantRequirement[] {
  return getContentImageRequiredVariantSurfaces(image, imageInBody).map(
    (surface) => ({
      assetId: image.id,
      label: image.alt || image.id,
      surface,
    }),
  );
}

function uniqueRoles(roles: Array<MediaUsageRole | null>) {
  return uniqueValues(roles.filter(isPresent));
}

function uniqueSurfaces(
  surfaces: Array<RequiredMediaVariantSurface | null>,
) {
  return uniqueValues(surfaces.filter(isPresent));
}

function uniqueValues<T>(items: T[]) {
  return [...new Set(items)];
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
