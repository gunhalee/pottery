import type {
  MediaAsset,
  MediaOwnerType,
  MediaUsageRole,
  MediaVariantName,
  MediaVariantSource,
  MediaVariantSourceMap,
} from "@/lib/media/media-model";

export type MediaVariantSurface =
  | "detail"
  | "list"
  | "master"
  | "thumbnail";

const fallbackBySurface: Record<MediaVariantSurface, MediaVariantName[]> = {
  detail: ["detail", "master", "list", "thumbnail"],
  list: ["list", "detail", "master", "thumbnail"],
  master: ["master", "detail", "list", "thumbnail"],
  thumbnail: ["thumbnail", "list", "detail", "master"],
};

export function buildMediaVariantSources(
  asset: MediaAsset,
): MediaVariantSourceMap {
  const sources: MediaVariantSourceMap = {
    master: {
      height: asset.height,
      src: asset.src,
      storagePath: asset.masterPath,
      variant: "master",
      width: asset.width,
    },
  };

  for (const variant of asset.variants) {
    sources[variant.variant] = {
      height: variant.height,
      src: variant.src,
      storagePath: variant.storagePath,
      variant: variant.variant,
      width: variant.width,
    };
  }

  return sources;
}

export function pickMediaVariantForRole(
  asset: MediaAsset,
  ownerType: MediaOwnerType,
  role: MediaUsageRole,
) {
  return pickVariantSource(
    buildMediaVariantSources(asset),
    getMediaSurfaceForRole(ownerType, role),
  );
}

export function pickMediaVariantForSurface(
  asset: MediaAsset,
  surface: MediaVariantSurface,
) {
  return pickVariantSource(buildMediaVariantSources(asset), surface);
}

export function pickVariantSource(
  sources: MediaVariantSourceMap | undefined,
  surface: MediaVariantSurface,
): MediaVariantSource | null {
  if (!sources) {
    return null;
  }

  for (const variant of fallbackBySurface[surface]) {
    const source = sources[variant];

    if (source?.src) {
      return source;
    }
  }

  return null;
}

function getMediaSurfaceForRole(
  _ownerType: MediaOwnerType,
  role: MediaUsageRole,
): MediaVariantSurface {
  if (role === "list") {
    return "list";
  }

  return "detail";
}
