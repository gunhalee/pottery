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

export type PickMediaVariantOptions = {
  allowFallback?: boolean;
};

const fallbackBySurface: Record<MediaVariantSurface, MediaVariantName[]> = {
  detail: ["detail", "master", "list", "thumbnail"],
  list: ["list", "detail", "master", "thumbnail"],
  master: ["master", "detail", "list", "thumbnail"],
  thumbnail: ["thumbnail", "list", "detail", "master"],
};

const surfaceByOwnerAndRole = {
  content_entry: {
    body: "detail",
    cover: "detail",
    description: "detail",
    detail: "detail",
    list: "list",
  },
  product: {
    body: "detail",
    cover: "detail",
    description: "detail",
    detail: "detail",
    list: "list",
  },
} satisfies Record<
  MediaOwnerType,
  Record<MediaUsageRole, MediaVariantSurface>
>;

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
  options?: PickMediaVariantOptions,
) {
  return pickVariantSource(
    buildMediaVariantSources(asset),
    getMediaVariantSurfaceForRole(ownerType, role),
    options,
  );
}

export function getMediaVariantSurfaceForRole(
  ownerType: MediaOwnerType,
  role: MediaUsageRole,
): MediaVariantSurface {
  return surfaceByOwnerAndRole[ownerType][role];
}

export function pickMediaVariantForSurface(
  asset: MediaAsset,
  surface: MediaVariantSurface,
  options?: PickMediaVariantOptions,
) {
  return pickVariantSource(buildMediaVariantSources(asset), surface, options);
}

export function pickVariantSource(
  sources: MediaVariantSourceMap | undefined,
  surface: MediaVariantSurface,
  options: PickMediaVariantOptions = {},
): MediaVariantSource | null {
  if (!sources) {
    return null;
  }

  const variants = options.allowFallback
    ? fallbackBySurface[surface]
    : ([surface] as MediaVariantName[]);

  for (const variant of variants) {
    const source = sources[variant];

    if (source?.src) {
      return source;
    }
  }

  return null;
}
