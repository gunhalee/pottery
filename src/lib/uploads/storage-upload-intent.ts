import "server-only";

import type { MediaOwnerType } from "@/lib/media/media-model";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type StorageUploadIntentStatus =
  | "claimed"
  | "cleaned"
  | "cleanup_pending"
  | "failed"
  | "pending"
  | "uploaded"
  | "uploading";

export type StorageUploadIntent = {
  assetId: string;
  bucket: string;
  completedAt: string | null;
  createdAt: string;
  errorMessage: string | null;
  id: string;
  metadata: Record<string, unknown>;
  ownerId: string | null;
  ownerType: MediaOwnerType | null;
  status: StorageUploadIntentStatus;
  storagePaths: string[];
  updatedAt: string;
};

export type StorageUploadIntentHandle = {
  id: string;
};

type StorageUploadIntentRow = {
  asset_id: string;
  bucket: string;
  completed_at: string | null;
  created_at: string;
  error_message: string | null;
  id: string;
  metadata: Record<string, unknown> | null;
  owner_id: string | null;
  owner_type: MediaOwnerType | null;
  status: StorageUploadIntentStatus;
  storage_paths: string[] | null;
  updated_at: string;
};

type CreateStorageUploadIntentInput = {
  assetId: string;
  bucket: string;
  metadata?: Record<string, unknown>;
  ownerId?: string;
  ownerType?: MediaOwnerType;
};

type UpdateStorageUploadIntentInput = {
  completed?: boolean;
  error?: unknown;
  status: StorageUploadIntentStatus;
  storagePaths?: string[];
};

export async function createStorageUploadIntent({
  assetId,
  bucket,
  metadata,
  ownerId,
  ownerType,
}: CreateStorageUploadIntentInput): Promise<StorageUploadIntentHandle> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("storage_upload_intents")
    .insert({
      asset_id: assetId,
      bucket,
      metadata: normalizeMetadata(metadata),
      owner_id: ownerId ?? null,
      owner_type: ownerType ?? null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to create storage upload intent: ${error.message}`);
  }

  return {
    id: data.id,
  };
}

export async function markStorageUploadIntentUploading(
  intent: StorageUploadIntentHandle,
) {
  await updateStorageUploadIntent(intent, { status: "uploading" });
}

export async function setStorageUploadIntentPaths(
  intent: StorageUploadIntentHandle,
  storagePaths: string[],
) {
  await updateStorageUploadIntent(intent, {
    status: "uploading",
    storagePaths,
  });
}

export async function markStorageUploadIntentUploaded(
  intent: StorageUploadIntentHandle,
  storagePaths: string[],
) {
  await updateStorageUploadIntent(intent, {
    status: "uploaded",
    storagePaths,
  });
}

export async function markStorageUploadIntentClaimed(
  intent: StorageUploadIntentHandle,
  storagePaths: string[],
) {
  await updateStorageUploadIntent(intent, {
    completed: true,
    status: "claimed",
    storagePaths,
  });
}

export async function markStorageUploadIntentCleaned(
  intent: StorageUploadIntentHandle,
  error: unknown | undefined,
  storagePaths: string[],
) {
  await updateStorageUploadIntent(intent, {
    completed: true,
    error,
    status: "cleaned",
    storagePaths,
  });
}

export async function markStorageUploadIntentCleanupPending(
  intent: StorageUploadIntentHandle,
  error: unknown,
  storagePaths: string[],
) {
  await updateStorageUploadIntent(intent, {
    error,
    status: "cleanup_pending",
    storagePaths,
  });
}

export async function markStorageUploadIntentFailed(
  intent: StorageUploadIntentHandle,
  error: unknown,
  storagePaths: string[] = [],
) {
  await updateStorageUploadIntent(intent, {
    completed: storagePaths.length === 0,
    error,
    status: storagePaths.length > 0 ? "cleanup_pending" : "failed",
    storagePaths,
  });
}

export async function readAbandonedStorageUploadIntents(
  cutoff: Date,
): Promise<StorageUploadIntent[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("storage_upload_intents")
    .select(
      "id, asset_id, bucket, owner_type, owner_id, status, storage_paths, error_message, metadata, completed_at, created_at, updated_at",
    )
    .in("status", ["cleanup_pending", "failed", "uploaded", "uploading"])
    .lt("created_at", cutoff.toISOString())
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to read storage upload intents: ${error.message}`);
  }

  return ((data ?? []) as StorageUploadIntentRow[])
    .map(mapStorageUploadIntentRow)
    .filter((intent) => intent.storagePaths.length > 0);
}

export async function readStorageUploadIntentById(
  id: string,
): Promise<StorageUploadIntent | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("storage_upload_intents")
    .select(
      "id, asset_id, bucket, owner_type, owner_id, status, storage_paths, error_message, metadata, completed_at, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read storage upload intent: ${error.message}`);
  }

  return data ? mapStorageUploadIntentRow(data as StorageUploadIntentRow) : null;
}

async function updateStorageUploadIntent(
  intent: StorageUploadIntentHandle,
  input: UpdateStorageUploadIntentInput,
) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("storage_upload_intents")
    .update({
      completed_at: input.completed ? new Date().toISOString() : null,
      error_message: input.error ? getErrorMessage(input.error) : null,
      status: input.status,
      storage_paths: input.storagePaths
        ? [...new Set(input.storagePaths)]
        : undefined,
    })
    .eq("id", intent.id);

  if (error) {
    console.error(`Failed to update storage upload intent: ${error.message}`);
  }
}

function mapStorageUploadIntentRow(
  row: StorageUploadIntentRow,
): StorageUploadIntent {
  return {
    assetId: row.asset_id,
    bucket: row.bucket,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    errorMessage: row.error_message,
    id: row.id,
    metadata: row.metadata ?? {},
    ownerId: row.owner_id,
    ownerType: row.owner_type,
    status: row.status,
    storagePaths: row.storage_paths ?? [],
    updatedAt: row.updated_at,
  };
}

function normalizeMetadata(metadata?: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(metadata ?? {})) as Record<string, unknown>;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown storage upload error.";
}
