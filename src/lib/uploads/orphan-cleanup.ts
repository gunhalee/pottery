import "server-only";

import { mediaAssetBucket } from "@/lib/media/media-store";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import {
  markStorageUploadIntentCleaned,
  readAbandonedStorageUploadIntents,
  readStorageUploadIntentById,
} from "@/lib/uploads/storage-upload-intent";

type StorageFile = {
  createdAt: string | null;
  path: string;
  updatedAt: string | null;
};

type StorageListItem = {
  created_at?: string | null;
  id?: string | null;
  metadata?: {
    size?: number;
  } | null;
  name: string;
  updated_at?: string | null;
};

type MediaAssetReference = {
  createdAt: string | null;
  id: string;
  masterPath: string;
  reserved: boolean;
  storagePaths: string[];
  updatedAt: string | null;
};

type MediaAssetReferenceRow = {
  created_at: string | null;
  id: string;
  master_path: string;
  media_variants?: Array<{ storage_path: string | null }> | null;
  reserved: boolean;
  updated_at: string | null;
};

type ReferencedStoragePaths = {
  mediaAssets: Map<string, MediaAssetReference>;
  mediaStoragePaths: Set<string>;
  usedAssetIds: Set<string>;
};

type CleanupReason =
  | "media_asset_unreferenced"
  | "media_storage_orphan"
  | "storage_upload_intent_abandoned";

type CleanupCandidate = {
  assetId?: string;
  bucket: string;
  intentId?: string;
  reason: CleanupReason;
  storagePath: string;
  storagePaths?: string[];
  timestamp: string;
};

export type UploadCleanupCandidate = CleanupCandidate;

type CleanupLogInput = CleanupCandidate & {
  dryRun: boolean;
  errorMessage?: string;
  success: boolean;
};

export type UploadCleanupOptions = {
  dryRun?: boolean;
  maxDeletesPerRun?: number;
  minAgeHours?: number;
};

export type UploadCleanupSummary = {
  candidates: number;
  deleted: number;
  dryRun: boolean;
  failed: number;
  minAgeHours: number;
  reasons: Record<CleanupReason, number>;
  skipped: number;
};

const defaultMinAgeHours = 48;
const defaultMaxDeletesPerRun = 100;

export async function inspectOrphanUploads(
  options: Pick<UploadCleanupOptions, "minAgeHours"> & {
    maxCandidates?: number;
  } = {},
) {
  if (!isSupabaseConfigured()) {
    return {
      candidates: [] satisfies UploadCleanupCandidate[],
      minAgeHours: options.minAgeHours ?? defaultMinAgeHours,
    };
  }

  const minAgeHours = options.minAgeHours ?? defaultMinAgeHours;
  const cutoff = new Date(Date.now() - minAgeHours * 60 * 60 * 1000);
  const references = await readReferencedStoragePaths();
  const candidates = await findCleanupCandidates(references, cutoff);

  return {
    candidates: candidates.slice(0, options.maxCandidates ?? candidates.length),
    minAgeHours,
  };
}

export async function cleanupOrphanUploads(
  options: UploadCleanupOptions = {},
): Promise<UploadCleanupSummary> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }

  const dryRun = options.dryRun ?? false;
  const minAgeHours = options.minAgeHours ?? defaultMinAgeHours;
  const maxDeletesPerRun = options.maxDeletesPerRun ?? defaultMaxDeletesPerRun;
  const cutoff = new Date(Date.now() - minAgeHours * 60 * 60 * 1000);
  const references = await readReferencedStoragePaths();
  const candidates = await findCleanupCandidates(references, cutoff);
  const eligibleCandidates = candidates.slice(0, maxDeletesPerRun);
  const summary: UploadCleanupSummary = {
    candidates: candidates.length,
    deleted: 0,
    dryRun,
    failed: 0,
    minAgeHours,
    reasons: {
      media_asset_unreferenced: 0,
      media_storage_orphan: 0,
      storage_upload_intent_abandoned: 0,
    },
    skipped: candidates.length - eligibleCandidates.length,
  };

  for (const candidate of eligibleCandidates) {
    summary.reasons[candidate.reason] += 1;

    if (dryRun) {
      await writeCleanupLog({
        ...candidate,
        dryRun,
        success: true,
      });
      continue;
    }

    const stillOrphan = await isStillOrphan(candidate);

    if (!stillOrphan) {
      summary.skipped += 1;
      await writeCleanupLog({
        ...candidate,
        dryRun,
        errorMessage: "Skipped because the asset was referenced before delete.",
        success: false,
      });
      continue;
    }

    try {
      await deleteCandidate(candidate);
      summary.deleted += 1;
      await writeCleanupLog({
        ...candidate,
        dryRun,
        success: true,
      });
    } catch (error) {
      summary.failed += 1;
      await writeCleanupLog({
        ...candidate,
        dryRun,
        errorMessage:
          error instanceof Error ? error.message : "Unknown cleanup error.",
        success: false,
      });
    }
  }

  return summary;
}

async function findCleanupCandidates(
  references: ReferencedStoragePaths,
  cutoff: Date,
) {
  const storageFiles = await listStorageFiles(mediaAssetBucket);
  const abandonedUploadIntents = await readAbandonedStorageUploadIntents(cutoff);
  const intentStoragePaths = new Set<string>();
  const candidates: CleanupCandidate[] = [];

  for (const intent of abandonedUploadIntents) {
    const storagePaths = [...new Set(intent.storagePaths)].filter(
      (storagePath) => !references.mediaStoragePaths.has(storagePath),
    );

    if (storagePaths.length === 0) {
      continue;
    }

    for (const storagePath of storagePaths) {
      intentStoragePaths.add(storagePath);
    }

    candidates.push({
      assetId: intent.assetId,
      bucket: intent.bucket,
      intentId: intent.id,
      reason: "storage_upload_intent_abandoned",
      storagePath: storagePaths[0],
      storagePaths,
      timestamp: intent.createdAt,
    });
  }

  for (const file of storageFiles) {
    if (
      isOlderThanCutoff(file, cutoff) &&
      !references.mediaStoragePaths.has(file.path) &&
      !intentStoragePaths.has(file.path)
    ) {
      candidates.push({
        bucket: mediaAssetBucket,
        reason: "media_storage_orphan",
        storagePath: file.path,
        timestamp: getFileTimestamp(file),
      });
    }
  }

  for (const asset of references.mediaAssets.values()) {
    if (
      !asset.reserved &&
      !references.usedAssetIds.has(asset.id) &&
      isTimestampOlderThanCutoff(asset.createdAt ?? asset.updatedAt, cutoff)
    ) {
      candidates.push({
        assetId: asset.id,
        bucket: mediaAssetBucket,
        reason: "media_asset_unreferenced",
        storagePath: asset.masterPath,
        storagePaths: asset.storagePaths,
        timestamp: asset.createdAt ?? asset.updatedAt ?? "",
      });
    }
  }

  return candidates.sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

async function readReferencedStoragePaths(): Promise<ReferencedStoragePaths> {
  const supabase = getSupabaseAdminClient();
  const [assetRows, usageRows] = await Promise.all([
    supabase
      .from("media_assets")
      .select("id, master_path, reserved, created_at, updated_at, media_variants (storage_path)"),
    supabase.from("media_usages").select("asset_id"),
  ]);

  if (assetRows.error) {
    throw new Error(`Failed to read media assets: ${assetRows.error.message}`);
  }

  if (usageRows.error) {
    throw new Error(`Failed to read media usages: ${usageRows.error.message}`);
  }

  const mediaAssets = new Map<string, MediaAssetReference>();
  const mediaStoragePaths = new Set<string>();

  for (const row of (assetRows.data ?? []) as MediaAssetReferenceRow[]) {
    const asset = toMediaAssetReference(row);

    for (const storagePath of asset.storagePaths) {
      mediaStoragePaths.add(storagePath);
    }

    mediaAssets.set(row.id, asset);
  }

  return {
    mediaAssets,
    mediaStoragePaths,
    usedAssetIds: new Set(
      ((usageRows.data ?? []) as Array<{ asset_id: string | null }>)
        .map((row) => row.asset_id)
        .filter((value): value is string => Boolean(value)),
    ),
  };
}

async function listStorageFiles(bucket: string, prefix = "") {
  const supabase = getSupabaseAdminClient();
  const files: StorageFile[] = [];
  const pageSize = 100;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: {
        column: "name",
        order: "asc",
      },
    });

    if (error) {
      if (isMissingBucketError(error)) {
        return files;
      }

      throw new Error(`Failed to list ${bucket}/${prefix}: ${error.message}`);
    }

    const items = (data ?? []) as StorageListItem[];

    for (const item of items) {
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name;

      if (isStorageObject(item)) {
        files.push({
          createdAt: item.created_at ?? null,
          path: itemPath,
          updatedAt: item.updated_at ?? null,
        });
      } else {
        files.push(...(await listStorageFiles(bucket, itemPath)));
      }
    }

    if (items.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return files;
}

async function isStillOrphan(candidate: CleanupCandidate) {
  if (candidate.reason === "storage_upload_intent_abandoned") {
    if (!candidate.intentId) {
      return false;
    }

    const intent = await readStorageUploadIntentById(candidate.intentId);

    if (!intent || intent.status === "claimed" || intent.status === "cleaned") {
      return false;
    }

    const storagePaths =
      intent.storagePaths.length > 0
        ? intent.storagePaths
        : candidate.storagePaths ?? [candidate.storagePath];

    return (
      storagePaths.length > 0 &&
      !(await storagePathsHaveMediaReference(storagePaths))
    );
  }

  if (candidate.reason === "media_storage_orphan") {
    return !(await storagePathHasMediaReference(candidate.storagePath));
  }

  if (!candidate.assetId) {
    return false;
  }

  const [asset, used] = await Promise.all([
    readMediaAssetReference(candidate.assetId),
    mediaAssetHasUsage(candidate.assetId),
  ]);

  return Boolean(
    asset &&
      !asset.reserved &&
      asset.masterPath === candidate.storagePath &&
      !used,
  );
}

async function deleteCandidate(candidate: CleanupCandidate) {
  const supabase = getSupabaseAdminClient();

  if (candidate.reason === "storage_upload_intent_abandoned") {
    const storagePaths = [
      ...new Set(candidate.storagePaths ?? [candidate.storagePath]),
    ];
    const { error: storageError } = await supabase.storage
      .from(candidate.bucket)
      .remove(storagePaths);

    if (storageError) {
      throw new Error(storageError.message);
    }

    if (candidate.intentId) {
      await markStorageUploadIntentCleaned(
        { id: candidate.intentId, persisted: true },
        undefined,
        storagePaths,
      );
    }

    return;
  }

  if (candidate.reason === "media_asset_unreferenced" && candidate.assetId) {
    const asset = await readMediaAssetReference(candidate.assetId);
    const storagePaths =
      asset?.storagePaths ?? candidate.storagePaths ?? [candidate.storagePath];
    const { error: storageError } = await supabase.storage
      .from(candidate.bucket)
      .remove(storagePaths);

    if (storageError) {
      throw new Error(storageError.message);
    }

    const { error: deleteRowError } = await supabase
      .from("media_assets")
      .delete()
      .eq("id", candidate.assetId);

    if (deleteRowError) {
      throw new Error(deleteRowError.message);
    }

    return;
  }

  const { error: storageError } = await supabase.storage
    .from(candidate.bucket)
    .remove([candidate.storagePath]);

  if (storageError) {
    throw new Error(storageError.message);
  }
}

async function readMediaAssetReference(assetId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("media_assets")
    .select("id, master_path, reserved, created_at, updated_at, media_variants (storage_path)")
    .eq("id", assetId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read media asset: ${error.message}`);
  }

  return data ? toMediaAssetReference(data as MediaAssetReferenceRow) : null;
}

async function mediaAssetHasUsage(assetId: string) {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase
    .from("media_usages")
    .select("asset_id", { count: "exact", head: true })
    .eq("asset_id", assetId);

  if (error) {
    throw new Error(`Failed to read media usage count: ${error.message}`);
  }

  return (count ?? 0) > 0;
}

async function storagePathHasMediaReference(storagePath: string) {
  const supabase = getSupabaseAdminClient();
  const [assetRows, variantRows] = await Promise.all([
    supabase
      .from("media_assets")
      .select("id")
      .eq("master_path", storagePath)
      .limit(1),
    supabase
      .from("media_variants")
      .select("asset_id")
      .eq("storage_path", storagePath)
      .limit(1),
  ]);

  if (assetRows.error) {
    throw new Error(`Failed to read media asset references: ${assetRows.error.message}`);
  }

  if (variantRows.error) {
    throw new Error(
      `Failed to read media variant references: ${variantRows.error.message}`,
    );
  }

  return (
    (assetRows.data?.length ?? 0) > 0 || (variantRows.data?.length ?? 0) > 0
  );
}

async function storagePathsHaveMediaReference(storagePaths: string[]) {
  const checks = await Promise.all(storagePaths.map(storagePathHasMediaReference));
  return checks.some(Boolean);
}

function toMediaAssetReference(row: MediaAssetReferenceRow): MediaAssetReference {
  return {
    createdAt: row.created_at,
    id: row.id,
    masterPath: row.master_path,
    reserved: row.reserved,
    storagePaths: [
      row.master_path,
      ...(row.media_variants ?? [])
        .map((variant) => variant.storage_path)
        .filter((value): value is string => Boolean(value)),
    ],
    updatedAt: row.updated_at,
  };
}

async function writeCleanupLog(input: CleanupLogInput) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("upload_cleanup_logs").insert({
    bucket: input.bucket,
    dry_run: input.dryRun,
    error_message: input.errorMessage ?? null,
    metadata: {
      assetId: input.assetId ?? null,
      intentId: input.intentId ?? null,
      timestamp: input.timestamp,
    },
    reason: input.reason,
    storage_path: input.storagePath,
    success: input.success,
  });

  if (error) {
    console.error("Failed to write upload cleanup log", error);
  }
}

function isStorageObject(item: StorageListItem) {
  return (
    item.name.endsWith(".webp") ||
    typeof item.metadata?.size === "number" ||
    Boolean(item.id)
  );
}

function isOlderThanCutoff(file: StorageFile, cutoff: Date) {
  return isTimestampOlderThanCutoff(file.createdAt ?? file.updatedAt, cutoff);
}

function isTimestampOlderThanCutoff(value: string | null | undefined, cutoff: Date) {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp < cutoff.getTime();
}

function getFileTimestamp(file: StorageFile) {
  return file.createdAt ?? file.updatedAt ?? "";
}

function isMissingBucketError(error: { message?: string; statusCode?: string }) {
  return error.statusCode === "404" || /not found/i.test(error.message ?? "");
}
