import "server-only";

import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { UploadCleanupLog } from "./types";

type CleanupLogRow = {
  bucket: string;
  created_at: string;
  dry_run: boolean;
  error_message: string | null;
  id: number;
  reason: string;
  storage_path: string;
  success: boolean;
};

export async function readUploadCleanupLogs(
  limit = 40,
): Promise<UploadCleanupLog[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("upload_cleanup_logs")
    .select(
      "id, bucket, storage_path, reason, dry_run, success, error_message, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingCleanupLogTableError(error)) {
      return [];
    }

    throw new Error(`Failed to read upload cleanup logs: ${error.message}`);
  }

  return ((data ?? []) as CleanupLogRow[]).map((row) => ({
    bucket: row.bucket,
    createdAt: row.created_at,
    dryRun: row.dry_run,
    errorMessage: row.error_message,
    id: row.id,
    reason: row.reason,
    storagePath: row.storage_path,
    success: row.success,
  }));
}

function isMissingCleanupLogTableError(error: { message?: string }) {
  const message = error.message ?? "";
  return (
    message.includes("upload_cleanup_logs") &&
    (message.includes("schema cache") || message.includes("does not exist"))
  );
}
