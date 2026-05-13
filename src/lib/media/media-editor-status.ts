import type { ContentImage } from "@/lib/content-manager/content-model";
import type {
  MediaVariantName,
  MediaVariantSourceMap,
} from "@/lib/media/media-model";
import {
  getContentImageRequiredVariantSurfaces,
  getContentImageRoleLabels,
  getProductImageRequiredVariantSurfaces,
  getProductImageRoleLabels,
} from "@/lib/media/media-role-requirements";
import type { MediaVariantSurface } from "@/lib/media/media-variant-policy";
import type { ProductImage } from "@/lib/shop/product-model";

export type MediaEditorStatusTone = "danger" | "ok" | "warning";

export type MediaEditorStatus = {
  exposureLabel: string;
  missingRequiredVariants: MediaVariantSurface[];
  missingSupportVariants: MediaVariantName[];
  publishIssues: string[];
  requiredVariants: MediaVariantSurface[];
  variantLabel: string;
  variantTone: MediaEditorStatusTone;
};

const supportVariants: MediaVariantName[] = ["master", "thumbnail"];

export function getProductImageEditorStatus(
  image: ProductImage,
): MediaEditorStatus {
  const roles = getProductImageRoleLabels(image);

  return buildMediaEditorStatus({
    exposureLabel: roles.length > 0 ? roles.join(" + ") : "노출 없음",
    imageLabel: image.alt,
    isManagedMedia: isManagedMedia(image.storagePath, image.variants),
    requiredVariants: getProductImageRequiredVariantSurfaces(image),
    variants: image.variants,
  });
}

export function getProductImagesPublishIssues(images: ProductImage[]) {
  const issues: string[] = [];
  const primaryImage = images.find((image) => image.isPrimary);
  const listImage = images.find((image) => image.isListImage);

  if (images.length === 0) {
    issues.push("상품 이미지가 없습니다.");
  }

  if (!primaryImage) {
    issues.push("대표 이미지가 필요합니다.");
  }

  if (!listImage) {
    issues.push("목록 이미지가 필요합니다.");
  }

  for (const image of images) {
    issues.push(...getProductImageEditorStatus(image).publishIssues);
  }

  return uniqueIssues(issues);
}

export function getContentImageEditorStatus(
  image: ContentImage,
  imageInBody: boolean,
): MediaEditorStatus {
  const roles = getContentImageRoleLabels(image, imageInBody);

  return buildMediaEditorStatus({
    exposureLabel: roles.length > 0 ? roles.join(" + ") : "노출 없음",
    imageLabel: image.alt,
    isManagedMedia: isManagedMedia(image.storagePath, image.variants),
    requiredVariants: getContentImageRequiredVariantSurfaces(
      image,
      imageInBody,
    ),
    variants: image.variants,
  });
}

export function getContentImagesPublishIssues(
  images: ContentImage[],
  bodyImageIds: Set<string>,
) {
  const issues: string[] = [];

  if (!images.some((image) => image.isCover)) {
    issues.push("대표 이미지가 필요합니다.");
  }

  if (!images.some((image) => image.isListImage)) {
    issues.push("목록 이미지가 필요합니다.");
  }

  for (const imageId of bodyImageIds) {
    if (!images.some((image) => image.id === imageId)) {
      issues.push("본문에서 참조하는 이미지가 이미지 목록에 없습니다.");
    }
  }

  for (const image of images) {
    issues.push(
      ...getContentImageEditorStatus(image, bodyImageIds.has(image.id))
        .publishIssues,
    );
  }

  return uniqueIssues(issues);
}

export function getVariantStatusLabel(
  variants: MediaVariantSourceMap | undefined,
) {
  const missing = (["detail", "list", "master", "thumbnail"] as const).filter(
    (variant) => !hasVariant(variants, variant),
  );

  return missing.length > 0 ? `${missing.join(", ")} 누락` : "variant 정상";
}

function buildMediaEditorStatus({
  exposureLabel,
  imageLabel,
  isManagedMedia,
  requiredVariants,
  variants,
}: {
  exposureLabel: string;
  imageLabel: string;
  isManagedMedia: boolean;
  requiredVariants: MediaVariantSurface[];
  variants: MediaVariantSourceMap | undefined;
}): MediaEditorStatus {
  const uniqueRequiredVariants = [
    ...new Set(requiredVariants),
  ] as MediaVariantSurface[];

  if (!isManagedMedia) {
    return {
      exposureLabel,
      missingRequiredVariants: [],
      missingSupportVariants: [],
      publishIssues: [],
      requiredVariants: uniqueRequiredVariants,
      variantLabel: "외부/임시 이미지",
      variantTone: "warning",
    };
  }

  const missingRequiredVariants = uniqueRequiredVariants.filter(
    (variant) => !hasVariant(variants, variant),
  );
  const missingSupportVariants = supportVariants.filter(
    (variant) => !hasVariant(variants, variant),
  );
  const publishIssues = missingRequiredVariants.map(
    (variant) => `${imageLabel || "이미지"}: ${variant} variant가 없습니다.`,
  );
  const variantLabel =
    missingRequiredVariants.length > 0
      ? `${missingRequiredVariants.join(", ")} 필요`
      : missingSupportVariants.length > 0
        ? `${missingSupportVariants.join(", ")} 점검`
        : "variant 정상";

  return {
    exposureLabel,
    missingRequiredVariants,
    missingSupportVariants,
    publishIssues,
    requiredVariants: uniqueRequiredVariants,
    variantLabel,
    variantTone:
      missingRequiredVariants.length > 0
        ? "danger"
        : missingSupportVariants.length > 0
          ? "warning"
          : "ok",
  };
}

function hasVariant(
  variants: MediaVariantSourceMap | undefined,
  variant: MediaVariantName,
) {
  return Boolean(variants?.[variant]?.src);
}

function isManagedMedia(
  storagePath: string | undefined,
  variants: MediaVariantSourceMap | undefined,
) {
  return Boolean(storagePath?.startsWith("assets/") || variants);
}

function uniqueIssues(issues: string[]) {
  return [...new Set(issues.filter(Boolean))];
}
