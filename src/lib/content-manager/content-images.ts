import {
  buildMediaVariantSources,
  getMediaVariantSurfaceForRole,
  pickVariantSource,
} from "@/lib/media/media-variant-policy";
import type {
  MediaVariantSurface,
  PickMediaVariantOptions,
} from "@/lib/media/media-variant-policy";
import type {
  MediaAsset,
  MediaUsage,
} from "@/lib/media/media-model";
import type { ContentImage, ContentImageLayout } from "./content-model";

type ContentImageSource = {
  images: ContentImage[];
};

export function getContentCoverImage(entry: ContentImageSource) {
  const image =
    entry.images.find((item) => item.isCover && !item.isReserved) ?? null;
  return image ? getContentImageForSurface(image, "detail") : null;
}

export function getContentDetailImages(entry: ContentImageSource) {
  return entry.images.flatMap((image) => {
    if (!image.isDetail || image.isReserved) {
      return [];
    }

    const detailImage = getContentImageForSurface(image, "detail");
    return detailImage ? [detailImage] : [];
  });
}

export function getContentListImage(entry: ContentImageSource) {
  return getFirstContentImageForSurface(
    entry.images.filter((item) => item.isListImage && !item.isReserved),
    "list",
  );
}

export function getContentBodyImage(image: ContentImage) {
  if (image.isReserved) {
    return null;
  }

  return getContentImageForSurface(image, "detail");
}

export function getContentAdminPreviewImage(image: ContentImage) {
  return withContentImageVariant(image, "thumbnail", {
    allowFallback: true,
  });
}

export function getContentEditorInsertImage(image: ContentImage) {
  return withContentImageVariant(image, "detail", {
    allowFallback: true,
  });
}

export function createContentImageFromMediaAsset({
  asset,
  layout,
  sortOrder = 0,
}: {
  asset: MediaAsset;
  layout: ContentImage["layout"];
  sortOrder?: number;
}): ContentImage {
  const variants = buildMediaVariantSources(asset);
  const image = getContentEditorInsertImage({
    alt: asset.alt,
    caption: asset.caption,
    createdAt: asset.createdAt,
    height: asset.height,
    id: asset.id,
    isCover: false,
    isDetail: false,
    isListImage: false,
    isReserved: asset.reserved,
    layout,
    sortOrder,
    src: asset.src,
    storagePath: asset.masterPath,
    updatedAt: asset.updatedAt,
    variants,
    width: asset.width,
  });

  return {
    ...image,
    variants,
  };
}

export function createContentImagesFromMediaUsages(
  usages: MediaUsage[],
): ContentImage[] {
  const groupedUsages = groupMediaUsagesByAsset(usages);

  return [...groupedUsages.values()]
    .map((assetUsages) => createContentImageFromMediaUsages(assetUsages))
    .filter((image): image is ContentImage => Boolean(image))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function getContentImageForSurface(
  image: ContentImage,
  surface: MediaVariantSurface,
) {
  const displayImage = withContentImageVariant(image, surface);
  return displayImage.src ? displayImage : null;
}

function getFirstContentImageForSurface(
  images: ContentImage[],
  surface: MediaVariantSurface,
) {
  const seen = new Set<string>();

  for (const image of images) {
    if (seen.has(image.id)) {
      continue;
    }

    seen.add(image.id);

    const displayImage = getContentImageForSurface(image, surface);

    if (displayImage) {
      return displayImage;
    }
  }

  return null;
}

function createContentImageFromMediaUsages(
  assetUsages: MediaUsage[],
): ContentImage | null {
  const asset = assetUsages[0]?.asset;

  if (!asset) {
    return null;
  }

  const roles = new Set(assetUsages.map((usage) => usage.role));
  const primaryUsage = pickPrimaryContentUsage(assetUsages);
  const surfaceRole = roles.has("list")
    ? "list"
    : (primaryUsage?.role ?? "detail");
  const surface = getMediaVariantSurfaceForRole("content_entry", surfaceRole);
  const variants = buildMediaVariantSources(asset);
  const displaySource = pickVariantSource(variants, surface);

  return {
    alt: primaryUsage?.altOverride ?? asset.alt,
    caption: primaryUsage?.captionOverride ?? asset.caption,
    createdAt: asset.createdAt,
    height: displaySource?.height ?? asset.height,
    id: asset.id,
    isCover: roles.has("cover"),
    isDetail: roles.has("detail"),
    isListImage: roles.has("list"),
    isReserved: asset.reserved,
    layout: getContentImageLayout(primaryUsage?.layout),
    sortOrder: Math.min(...assetUsages.map((usage) => usage.sortOrder)),
    src: displaySource?.src ?? asset.src,
    storagePath: asset.masterPath,
    updatedAt: asset.updatedAt,
    variants,
    width: displaySource?.width ?? asset.width,
  };
}

function pickPrimaryContentUsage(assetUsages: MediaUsage[]) {
  return (
    assetUsages.find((usage) => usage.role === "body") ??
    assetUsages.find((usage) => usage.role === "detail") ??
    assetUsages.find((usage) => usage.role === "cover") ??
    assetUsages[0]
  );
}

function getContentImageLayout(layout: string | undefined): ContentImageLayout {
  return isContentImageLayout(layout) ? layout : "default";
}

function isContentImageLayout(
  value: string | undefined,
): value is ContentImageLayout {
  return (
    value === "align-left" ||
    value === "align-right" ||
    value === "default" ||
    value === "full" ||
    value === "two-column" ||
    value === "wide"
  );
}

function groupMediaUsagesByAsset(usages: MediaUsage[]) {
  const grouped = new Map<string, MediaUsage[]>();

  for (const usage of usages) {
    const assetUsages = grouped.get(usage.assetId) ?? [];
    assetUsages.push(usage);
    grouped.set(usage.assetId, assetUsages);
  }

  return grouped;
}

export function withContentImageVariant(
  image: ContentImage,
  surface: MediaVariantSurface,
  options?: PickMediaVariantOptions,
) {
  const variant = pickVariantSource(image.variants, surface, options);

  if (!variant) {
    if (image.variants) {
      return {
        ...image,
        src: "",
      };
    }

    return image;
  }

  return {
    ...image,
    height: variant.height,
    src: variant.src,
    storagePath: variant.storagePath ?? image.storagePath,
    width: variant.width,
  };
}
