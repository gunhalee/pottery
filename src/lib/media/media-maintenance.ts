import "server-only";

import {
  buildMediaVariantSources,
  getMediaVariantSurfaceForRole,
  pickVariantSource,
  type MediaVariantSurface,
} from "@/lib/media/media-variant-policy";
import {
  mediaAssetBucket,
  readMediaAssetsByIds,
  readMediaLibraryAssets,
} from "@/lib/media/media-store";
import {
  buildImageVariants,
  ensureMediaAssetBucket,
} from "@/lib/media/media-upload";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type {
  MediaAsset,
  MediaOwnerType,
  MediaUsageRole,
  MediaVariantName,
} from "./media-model";

export type MediaDiagnosticSeverity = "error" | "warning";

export type MediaDiagnosticIssueCode =
  | "broken_usage"
  | "duplicate_variant_path"
  | "master_missing"
  | "orphan_asset"
  | "owner_missing"
  | "role_variant_fallback"
  | "shared_storage_path"
  | "variant_missing";

export type MediaDiagnosticIssue = {
  code: MediaDiagnosticIssueCode;
  description: string;
  severity: MediaDiagnosticSeverity;
  title: string;
};

export type MediaVariantFallbackDiagnostic = {
  expectedSurface: MediaVariantSurface;
  ownerId: string;
  ownerType: MediaOwnerType;
  role: MediaUsageRole;
  selectedVariant: MediaVariantName;
  usageId: string;
};

export type MediaAssetDiagnostic = {
  asset: MediaAsset & { usageCount: number };
  canRegenerate: boolean;
  fallbackCount: number;
  fallbackUsages: MediaVariantFallbackDiagnostic[];
  health: "error" | "ok" | "warning";
  issues: MediaDiagnosticIssue[];
  missingVariants: MediaVariantName[];
  sharedStoragePaths: string[];
};

export type BrokenMediaUsageDiagnostic = {
  assetId: string;
  id: string;
  issue: MediaDiagnosticIssue;
  ownerId: string;
  ownerType: MediaOwnerType;
  role: MediaUsageRole;
};

export type MediaDiagnosticsDashboard = {
  assets: MediaAssetDiagnostic[];
  brokenUsages: BrokenMediaUsageDiagnostic[];
  stats: {
    brokenUsages: number;
    errorAssets: number;
    fallbackTargets: Record<MediaVariantSurface, number>;
    fallbackUsages: number;
    okAssets: number;
    orphanAssets: number;
    ownerMissingUsages: number;
    sharedStoragePathAssets: number;
    totalAssets: number;
    warningAssets: number;
  };
};

export type MediaVariantRequirement = {
  assetId: string;
  label: string;
  surface: Exclude<MediaVariantSurface, "master" | "thumbnail">;
};

type RawMediaUsageRow = {
  asset_id: string;
  id: string;
  owner_id: string;
  owner_type: MediaOwnerType;
  role: MediaUsageRole;
};

const requiredStoredVariants: MediaVariantName[] = [
  "master",
  "detail",
  "list",
  "thumbnail",
];

export async function getMediaDiagnostics(
  limit = 160,
): Promise<MediaDiagnosticsDashboard> {
  if (!isSupabaseConfigured()) {
    return emptyDiagnostics();
  }

  const [initialAssets, usages] = await Promise.all([
    readMediaLibraryAssets(limit, { includeReserved: true }),
    readRawMediaUsages(),
  ]);
  let assets = initialAssets;
  const usagesByAsset = groupUsagesByAsset(usages);
  const referencedAssets = await readReferencedAssetsMissingFromPage(
    assets,
    usages,
    usagesByAsset,
  );
  assets = mergeDiagnosticAssets(assets, referencedAssets);
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const ownerIndex = await readMediaUsageOwnerIndex(usages);
  const brokenUsages = [
    ...(usages
      .filter((usage) => !assetMap.has(usage.asset_id))
      .map((usage) => ({
      assetId: usage.asset_id,
      id: usage.id,
      issue: {
        code: "broken_usage" as const,
        description: "usage는 남아 있지만 연결된 media asset을 찾을 수 없습니다.",
        severity: "error" as const,
        title: "깨진 미디어 참조",
      },
      ownerId: usage.owner_id,
      ownerType: usage.owner_type,
      role: usage.role,
      }))),
    ...getOwnerMissingMediaUsages(usages, ownerIndex),
  ];
  const diagnostics = addSharedStoragePathIssues(
    assets.map((asset) =>
      diagnoseAsset(asset, usagesByAsset.get(asset.id) ?? []),
    ),
  );
  const fallbackTargets = getFallbackTargetStats(diagnostics);

  return {
    assets: diagnostics.sort(sortDiagnostics),
    brokenUsages,
    stats: {
      brokenUsages: brokenUsages.length,
      errorAssets: diagnostics.filter((item) => item.health === "error").length,
      fallbackTargets,
      fallbackUsages: diagnostics.reduce(
        (total, item) => total + item.fallbackCount,
        0,
      ),
      okAssets: diagnostics.filter((item) => item.health === "ok").length,
      orphanAssets: diagnostics.filter((item) =>
        item.issues.some((issue) => issue.code === "orphan_asset"),
      ).length,
      ownerMissingUsages: brokenUsages.filter(
        (item) => item.issue.code === "owner_missing",
      ).length,
      sharedStoragePathAssets: diagnostics.filter(
        (item) => item.sharedStoragePaths.length > 0,
      ).length,
      totalAssets: diagnostics.length,
      warningAssets: diagnostics.filter((item) => item.health === "warning")
        .length,
    },
  };
}

export async function findMissingMediaVariantRequirements(
  requirements: MediaVariantRequirement[],
) {
  if (!isSupabaseConfigured() || requirements.length === 0) {
    return [] satisfies MediaVariantRequirement[];
  }

  const assets = await readMediaAssetsByIds([
    ...new Set(requirements.map((requirement) => requirement.assetId)),
  ]);
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));

  return requirements.filter((requirement) => {
    const asset = assetMap.get(requirement.assetId);

    if (!asset) {
      return true;
    }

    return !hasExactSurfaceVariant(asset, requirement.surface);
  });
}

export async function regenerateMediaAssetVariants(assetId: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase Storage 설정이 필요합니다.");
  }

  const [asset] = await readMediaAssetsByIds([assetId]);

  if (!asset) {
    throw new Error("재생성할 미디어 asset을 찾을 수 없습니다.");
  }

  if (!asset.masterPath) {
    throw new Error(
      "원본 이미지 경로가 없어 variant를 재생성할 수 없습니다. 실제 이미지를 다시 업로드한 뒤 시도하세요.",
    );
  }

  if (asset.bucket !== mediaAssetBucket) {
    throw new Error(
      `이 asset은 ${mediaAssetBucket} 버킷의 이미지가 아니어서 자동 재생성을 실행할 수 없습니다.`,
    );
  }

  const supabase = getSupabaseAdminClient();
  await ensureMediaAssetBucket();

  const { data, error } = await supabase.storage
    .from(mediaAssetBucket)
    .download(asset.masterPath);

  if (error || !data) {
    throw new Error(buildMasterDownloadErrorMessage(error?.message));
  }

  const variants = await buildImageVariants(
    Buffer.from(await data.arrayBuffer()),
    asset.id,
  );
  const uploadedPaths: string[] = [];

  try {
    for (const variant of variants) {
      const { error: uploadError } = await supabase.storage
        .from(mediaAssetBucket)
        .upload(variant.storagePath, variant.data, {
          cacheControl: "31536000",
          contentType: "image/webp",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      uploadedPaths.push(variant.storagePath);
    }

    const getPublicUrl = (storagePath: string) =>
      supabase.storage.from(mediaAssetBucket).getPublicUrl(storagePath).data
        .publicUrl;
    const master = variants.find((variant) => variant.variant === "master");

    if (!master) {
      throw new Error("master variant가 생성되지 않았습니다.");
    }

    const { error: assetError } = await supabase
      .from("media_assets")
      .update({
        height: master.height,
        master_path: master.storagePath,
        mime_type: "image/webp",
        size_bytes: master.data.length,
        src: getPublicUrl(master.storagePath),
        width: master.width,
      })
      .eq("id", asset.id);

    if (assetError) {
      throw new Error(`media asset 갱신 실패: ${assetError.message}`);
    }

    const { error: variantError } = await supabase
      .from("media_variants")
      .upsert(
        variants.map((variant) => ({
          asset_id: asset.id,
          height: variant.height,
          size_bytes: variant.data.length,
          src: getPublicUrl(variant.storagePath),
          storage_path: variant.storagePath,
          variant: variant.variant,
          width: variant.width,
        })),
        { onConflict: "asset_id,variant" },
      );

    if (variantError) {
      throw new Error(`media variants 갱신 실패: ${variantError.message}`);
    }
  } catch (error) {
    if (uploadedPaths.length > 0) {
      console.error("[media-variant-regenerate]", {
        assetId,
        error,
        uploadedPaths,
      });
    }

    throw error;
  }

  const [updated] = await readMediaAssetsByIds([asset.id]);
  return updated ?? asset;
}

function buildMasterDownloadErrorMessage(message?: string) {
  const storageMessage = message ?? "응답 없음";

  if (/not found/i.test(storageMessage)) {
    return "원본 이미지 파일을 Storage에서 찾지 못했습니다. 이 asset은 현재 variant 재생성이 불가능하니 실제 이미지를 다시 업로드하거나, 어디에도 연결되지 않았다면 cleanup으로 삭제하세요.";
  }

  return `원본 이미지 파일을 읽지 못했습니다. 잠시 후 다시 시도하고, 계속 실패하면 이미지를 다시 업로드하세요. Storage 응답: ${storageMessage}`;
}

async function readRawMediaUsages() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("media_usages")
    .select("id, asset_id, owner_id, owner_type, role");

  if (error) {
    throw new Error(`Failed to read media usages: ${error.message}`);
  }

  return (data ?? []) as RawMediaUsageRow[];
}

async function readReferencedAssetsMissingFromPage(
  assets: Array<MediaAsset & { usageCount: number }>,
  usages: RawMediaUsageRow[],
  usagesByAsset: Map<string, RawMediaUsageRow[]>,
) {
  const assetIds = new Set(assets.map((asset) => asset.id));
  const missingAssetIds = [
    ...new Set(
      usages
        .map((usage) => usage.asset_id)
        .filter((assetId) => !assetIds.has(assetId)),
    ),
  ];

  if (missingAssetIds.length === 0) {
    return [] satisfies Array<MediaAsset & { usageCount: number }>;
  }

  const referencedAssets = await readMediaAssetsByIds(missingAssetIds);

  return referencedAssets.map((asset) => ({
    ...asset,
    usageCount: usagesByAsset.get(asset.id)?.length ?? 0,
  }));
}

function mergeDiagnosticAssets(
  assets: Array<MediaAsset & { usageCount: number }>,
  referencedAssets: Array<MediaAsset & { usageCount: number }>,
) {
  const merged = new Map<string, MediaAsset & { usageCount: number }>();

  for (const asset of [...assets, ...referencedAssets]) {
    const previous = merged.get(asset.id);
    merged.set(
      asset.id,
      previous ? { ...asset, usageCount: previous.usageCount } : asset,
    );
  }

  return [...merged.values()];
}

async function readMediaUsageOwnerIndex(usages: RawMediaUsageRow[]) {
  const idsByType = groupUsageOwnerIds(usages);
  const [productIds, contentEntryIds] = await Promise.all([
    readExistingOwnerIds("shop_products", idsByType.product),
    readExistingOwnerIds("content_entries", idsByType.content_entry),
  ]);

  return new Set([
    ...productIds.map((id) => ownerKey("product", id)),
    ...contentEntryIds.map((id) => ownerKey("content_entry", id)),
  ]);
}

async function readExistingOwnerIds(table: string, ids: string[]) {
  if (ids.length === 0) {
    return [] satisfies string[];
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .in("id", [...new Set(ids)]);

  if (error) {
    throw new Error(`Failed to read ${table} media owners: ${error.message}`);
  }

  return ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
}

function groupUsageOwnerIds(usages: RawMediaUsageRow[]) {
  const grouped: Record<MediaOwnerType, string[]> = {
    content_entry: [],
    product: [],
  };

  for (const usage of usages) {
    grouped[usage.owner_type].push(usage.owner_id);
  }

  return grouped;
}

function ownerKey(ownerType: MediaOwnerType, ownerId: string) {
  return `${ownerType}:${ownerId}`;
}

function getOwnerMissingMediaUsages(
  usages: RawMediaUsageRow[],
  ownerIndex: Set<string>,
) {
  return usages
    .filter((usage) => !ownerIndex.has(ownerKey(usage.owner_type, usage.owner_id)))
    .map((usage) => ({
      assetId: usage.asset_id,
      id: usage.id,
      issue: {
        code: "owner_missing" as const,
        description: "media usage가 연결된 상품/콘텐츠 row를 찾을 수 없습니다.",
        severity: "error" as const,
        title: "owner row 누락",
      },
      ownerId: usage.owner_id,
      ownerType: usage.owner_type,
      role: usage.role,
    }));
}

function diagnoseAsset(
  asset: MediaAsset & { usageCount: number },
  usages: RawMediaUsageRow[],
): MediaAssetDiagnostic {
  const issues: MediaDiagnosticIssue[] = [];
  const missingVariants = getMissingStoredVariants(asset);
  const duplicatedPaths = getDuplicatedVariantPaths(asset);
  const fallbackUsages = getRoleVariantFallbacks(asset, usages);
  const fallbackCount = fallbackUsages.length;

  if (!asset.masterPath || !asset.src) {
    issues.push({
      code: "master_missing",
      description: "원본 기준 이미지가 없어 variant 재생성이 불가능합니다.",
      severity: "error",
      title: "master 이미지 누락",
    });
  }

  if (missingVariants.length > 0) {
    issues.push({
      code: "variant_missing",
      description: `${missingVariants.join(", ")} variant가 없습니다.`,
      severity: missingVariants.includes("master") ? "error" : "warning",
      title: "이미지 variant 누락",
    });
  }

  if (duplicatedPaths.length > 0) {
    issues.push({
      code: "duplicate_variant_path",
      description: `중복 storage path: ${duplicatedPaths.join(", ")}`,
      severity: "error",
      title: "variant 경로 중복",
    });
  }

  if (fallbackCount > 0) {
    issues.push({
      code: "role_variant_fallback",
      description: `${fallbackCount}개 usage가 역할에 맞는 variant 대신 fallback 이미지를 사용합니다.`,
      severity: "warning",
      title: "역할별 variant fallback",
    });
  }

  if (!asset.reserved && asset.usageCount === 0) {
    issues.push({
      code: "orphan_asset",
      description: "어디에도 연결되지 않은 asset입니다. cleanup 후보가 될 수 있습니다.",
      severity: "warning",
      title: "미사용 asset",
    });
  }

  return {
    asset,
    canRegenerate: Boolean(asset.masterPath && asset.bucket === mediaAssetBucket),
    fallbackCount,
    fallbackUsages,
    health: getHealth(issues),
    issues,
    missingVariants,
    sharedStoragePaths: [],
  };
}

function addSharedStoragePathIssues(diagnostics: MediaAssetDiagnostic[]) {
  const assetIdsByPath = new Map<string, Set<string>>();

  for (const item of diagnostics) {
    for (const path of getUniqueStoragePathsForAsset(item.asset)) {
      const assetIds = assetIdsByPath.get(path) ?? new Set<string>();
      assetIds.add(item.asset.id);
      assetIdsByPath.set(path, assetIds);
    }
  }

  const sharedPathsByAsset = new Map<string, string[]>();

  for (const [path, assetIds] of assetIdsByPath.entries()) {
    if (assetIds.size <= 1) {
      continue;
    }

    for (const assetId of assetIds) {
      sharedPathsByAsset.set(assetId, [
        ...(sharedPathsByAsset.get(assetId) ?? []),
        path,
      ]);
    }
  }

  return diagnostics.map((item) => {
    const sharedStoragePaths = sharedPathsByAsset.get(item.asset.id) ?? [];

    if (sharedStoragePaths.length === 0) {
      return item;
    }

    const issues = [
      ...item.issues,
      {
        code: "shared_storage_path" as const,
        description: `다른 asset과 storage path를 공유합니다: ${sharedStoragePaths.join(", ")}`,
        severity: "error" as const,
        title: "asset 간 storage path 중복",
      },
    ];

    return {
      ...item,
      health: getHealth(issues),
      issues,
      sharedStoragePaths,
    };
  });
}

function getUniqueStoragePathsForAsset(asset: MediaAsset) {
  return [
    ...new Set(
      [asset.masterPath, ...asset.variants.map((variant) => variant.storagePath)]
        .map((path) => path?.trim())
        .filter((path): path is string => Boolean(path)),
    ),
  ];
}

function getMissingStoredVariants(asset: MediaAsset) {
  const variantNames = new Set<MediaVariantName>([
    asset.masterPath ? "master" : undefined,
    ...asset.variants.map((variant) => variant.variant),
  ].filter((variant): variant is MediaVariantName => Boolean(variant)));

  return requiredStoredVariants.filter((variant) => !variantNames.has(variant));
}

function getDuplicatedVariantPaths(asset: MediaAsset) {
  const entries: Array<{ path: string; source: string }> = [];

  if (asset.masterPath) {
    entries.push({ path: asset.masterPath, source: "asset_master" });
  }

  for (const variant of asset.variants) {
    if (!variant.storagePath) {
      continue;
    }

    entries.push({
      path: variant.storagePath,
      source: `variant:${variant.variant}`,
    });
  }

  const grouped = new Map<string, string[]>();

  for (const entry of entries) {
    grouped.set(entry.path, [...(grouped.get(entry.path) ?? []), entry.source]);
  }

  return [...grouped.entries()]
    .filter(([, sources]) => {
      if (sources.length <= 1) {
        return false;
      }

      return !isExpectedMasterPathMirror(sources);
    })
    .map(([path]) => path);
}

function isExpectedMasterPathMirror(sources: string[]) {
  const uniqueSources = new Set(sources);

  return (
    sources.length === 2 &&
    uniqueSources.has("asset_master") &&
    uniqueSources.has("variant:master")
  );
}

function getRoleVariantFallbacks(
  asset: MediaAsset,
  usages: RawMediaUsageRow[],
): MediaVariantFallbackDiagnostic[] {
  const sources = buildMediaVariantSources(asset);
  const fallbacks: MediaVariantFallbackDiagnostic[] = [];

  for (const usage of usages) {
    const expectedSurface = getMediaVariantSurfaceForRole(
      usage.owner_type,
      usage.role,
    );
    const selected = pickVariantSource(sources, expectedSurface, {
      allowFallback: true,
    });

    if (!selected || selected.variant === expectedSurface) {
      continue;
    }

    fallbacks.push({
      expectedSurface,
      ownerId: usage.owner_id,
      ownerType: usage.owner_type,
      role: usage.role,
      selectedVariant: selected.variant,
      usageId: usage.id,
    });
  }

  return fallbacks;
}

function hasExactSurfaceVariant(asset: MediaAsset, surface: MediaVariantSurface) {
  const source = buildMediaVariantSources(asset)[surface];
  return Boolean(source?.src);
}

function getHealth(
  issues: MediaDiagnosticIssue[],
): MediaAssetDiagnostic["health"] {
  if (issues.some((issue) => issue.severity === "error")) {
    return "error";
  }

  if (issues.length > 0) {
    return "warning";
  }

  return "ok";
}

function groupUsagesByAsset(usages: RawMediaUsageRow[]) {
  const grouped = new Map<string, RawMediaUsageRow[]>();

  for (const usage of usages) {
    const assetUsages = grouped.get(usage.asset_id) ?? [];
    assetUsages.push(usage);
    grouped.set(usage.asset_id, assetUsages);
  }

  return grouped;
}

function sortDiagnostics(
  a: MediaAssetDiagnostic,
  b: MediaAssetDiagnostic,
) {
  const rank = {
    error: 0,
    warning: 1,
    ok: 2,
  };
  const rankDiff = rank[a.health] - rank[b.health];

  if (rankDiff !== 0) {
    return rankDiff;
  }

  return b.asset.createdAt.localeCompare(a.asset.createdAt);
}

function getFallbackTargetStats(diagnostics: MediaAssetDiagnostic[]) {
  const stats = createEmptyFallbackTargetStats();

  for (const item of diagnostics) {
    for (const usage of item.fallbackUsages) {
      stats[usage.expectedSurface] += 1;
    }
  }

  return stats;
}

function createEmptyFallbackTargetStats(): Record<MediaVariantSurface, number> {
  return {
    detail: 0,
    list: 0,
    master: 0,
    thumbnail: 0,
  };
}

function emptyDiagnostics(): MediaDiagnosticsDashboard {
  return {
    assets: [],
    brokenUsages: [],
    stats: {
      brokenUsages: 0,
      errorAssets: 0,
      fallbackTargets: createEmptyFallbackTargetStats(),
      fallbackUsages: 0,
      okAssets: 0,
      orphanAssets: 0,
      ownerMissingUsages: 0,
      sharedStoragePathAssets: 0,
      totalAssets: 0,
      warningAssets: 0,
    },
  };
}
