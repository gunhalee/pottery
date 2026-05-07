import "server-only";

import {
  buildMediaVariantSources,
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
  | "role_variant_fallback"
  | "variant_missing";

export type MediaDiagnosticIssue = {
  code: MediaDiagnosticIssueCode;
  description: string;
  severity: MediaDiagnosticSeverity;
  title: string;
};

export type MediaAssetDiagnostic = {
  asset: MediaAsset & { usageCount: number };
  canRegenerate: boolean;
  fallbackCount: number;
  health: "error" | "ok" | "warning";
  issues: MediaDiagnosticIssue[];
  missingVariants: MediaVariantName[];
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
    fallbackUsages: number;
    okAssets: number;
    orphanAssets: number;
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

  const [assets, usages] = await Promise.all([
    readMediaLibraryAssets(limit),
    readRawMediaUsages(),
  ]);
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const usagesByAsset = groupUsagesByAsset(usages);
  const brokenUsages = usages
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
    }));
  const diagnostics = assets.map((asset) =>
    diagnoseAsset(asset, usagesByAsset.get(asset.id) ?? []),
  );

  return {
    assets: diagnostics.sort(sortDiagnostics),
    brokenUsages,
    stats: {
      brokenUsages: brokenUsages.length,
      errorAssets: diagnostics.filter((item) => item.health === "error").length,
      fallbackUsages: diagnostics.reduce(
        (total, item) => total + item.fallbackCount,
        0,
      ),
      okAssets: diagnostics.filter((item) => item.health === "ok").length,
      orphanAssets: diagnostics.filter((item) =>
        item.issues.some((issue) => issue.code === "orphan_asset"),
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

function diagnoseAsset(
  asset: MediaAsset & { usageCount: number },
  usages: RawMediaUsageRow[],
): MediaAssetDiagnostic {
  const issues: MediaDiagnosticIssue[] = [];
  const missingVariants = getMissingStoredVariants(asset);
  const duplicatedPaths = getDuplicatedVariantPaths(asset);
  const fallbackCount = usages.filter((usage) =>
    isRoleUsingFallback(asset, usage.role),
  ).length;

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
    health: getHealth(issues),
    issues,
    missingVariants,
  };
}

function getMissingStoredVariants(asset: MediaAsset) {
  const variantNames = new Set<MediaVariantName>([
    asset.masterPath ? "master" : undefined,
    ...asset.variants.map((variant) => variant.variant),
  ].filter((variant): variant is MediaVariantName => Boolean(variant)));

  return requiredStoredVariants.filter((variant) => !variantNames.has(variant));
}

function getDuplicatedVariantPaths(asset: MediaAsset) {
  const counts = new Map<string, number>();

  for (const path of [
    asset.masterPath,
    ...asset.variants.map((variant) => variant.storagePath),
  ]) {
    if (!path) {
      continue;
    }

    counts.set(path, (counts.get(path) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([path]) => path);
}

function isRoleUsingFallback(asset: MediaAsset, role: MediaUsageRole) {
  const surface = getSurfaceForRole(role);
  const selected = pickVariantSource(buildMediaVariantSources(asset), surface);
  return Boolean(selected && selected.variant !== surface);
}

function hasExactSurfaceVariant(asset: MediaAsset, surface: MediaVariantSurface) {
  const source = buildMediaVariantSources(asset)[surface];
  return Boolean(source?.src);
}

function getSurfaceForRole(role: MediaUsageRole): MediaVariantSurface {
  return role === "list" ? "list" : "detail";
}

function getHealth(issues: MediaDiagnosticIssue[]) {
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

function emptyDiagnostics(): MediaDiagnosticsDashboard {
  return {
    assets: [],
    brokenUsages: [],
    stats: {
      brokenUsages: 0,
      errorAssets: 0,
      fallbackUsages: 0,
      okAssets: 0,
      orphanAssets: 0,
      totalAssets: 0,
      warningAssets: 0,
    },
  };
}
