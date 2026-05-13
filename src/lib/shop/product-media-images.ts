import type { MediaUsage } from "@/lib/media/media-model";
import {
  buildMediaVariantSources,
  pickMediaVariantForRole,
} from "@/lib/media/media-variant-policy";
import type { ProductImage } from "./product-model";

export function createProductImagesFromMediaUsages(
  usages: MediaUsage[],
): ProductImage[] {
  const groupedUsages = groupMediaUsagesByAsset(usages);
  const sortOrderByAssetId = new Map(
    [...groupedUsages.entries()].map(([assetId, assetUsages]) => [
      assetId,
      Math.min(...assetUsages.map((usage) => usage.sortOrder)),
    ]),
  );

  return [...groupedUsages.values()]
    .map((assetUsages) => createProductImageFromMediaUsages(assetUsages))
    .filter((image): image is ProductImage => Boolean(image))
    .sort((a, b) => {
      const aOrder = sortOrderByAssetId.get(a.id ?? "") ?? 0;
      const bOrder = sortOrderByAssetId.get(b.id ?? "") ?? 0;

      return aOrder - bOrder;
    });
}

function createProductImageFromMediaUsages(
  assetUsages: MediaUsage[],
): ProductImage | null {
  const asset = assetUsages[0]?.asset;

  if (!asset) {
    return null;
  }

  const roles = new Set(assetUsages.map((usage) => usage.role));
  const primaryUsage = pickPrimaryProductUsage(assetUsages);
  const variantRole = roles.has("list")
    ? "list"
    : (primaryUsage?.role ?? "detail");
  const imageVariant = pickMediaVariantForRole(asset, "product", variantRole);
  const variants = buildMediaVariantSources(asset);

  return {
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
  };
}

function pickPrimaryProductUsage(assetUsages: MediaUsage[]) {
  return (
    assetUsages.find((usage) => usage.role === "cover") ??
    assetUsages.find((usage) => usage.role === "list") ??
    assetUsages[0]
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
