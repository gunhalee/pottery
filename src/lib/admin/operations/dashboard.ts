import "server-only";

import { readContentEntries } from "@/lib/content-manager/content-store";
import { getMediaDiagnostics } from "@/lib/media/media-maintenance";
import { readCronRunLogs } from "@/lib/ops/cron-run-log";
import { readRateLimitBuckets } from "@/lib/security/rate-limit";
import { readProducts } from "@/lib/shop/product-store";
import { inspectOrphanUploads } from "@/lib/uploads/orphan-cleanup";
import { readUploadCleanupLogs } from "./cleanup-logs";
import { buildHealthItems } from "./health";
import { buildMediaReferenceData } from "./media-references";
import type { OperationsDashboardData } from "./types";

export async function getOperationsDashboardData(): Promise<OperationsDashboardData> {
  const [
    cleanupLogs,
    cleanupPreview,
    cronRunLogs,
    products,
    rateLimitBuckets,
    entries,
    mediaDiagnostics,
  ] = await Promise.all([
    readUploadCleanupLogs(),
    inspectOrphanUploads({
      abandonedIntentMinAgeHours: 12,
      maxCandidates: 30,
      storageOrphanMinAgeHours: 24,
      unreferencedAssetMinAgeHours: 48,
    }),
    readCronRunLogs(),
    readProducts(),
    readRateLimitBuckets(),
    readContentEntries(),
    getMediaDiagnostics(120),
  ]);
  const { mediaReferences, productContentLinks } = buildMediaReferenceData({
    entries,
    products,
  });
  const productImages = mediaReferences.filter(
    (item) => item.ownerType === "product",
  ).length;
  const contentImages = mediaReferences.length - productImages;
  const stats = {
    bodyUnlinkedImages: mediaReferences.filter(
      (item) => item.status === "body-unlinked",
    ).length,
    cleanupFailures: cleanupLogs.filter((log) => !log.success).length,
    cleanupPreviewCandidates: cleanupPreview.candidates.length,
    contentImages,
    cronFailures: cronRunLogs.filter((log) => log.status === "failed").length,
    mediaVariantIssues:
      mediaDiagnostics.stats.errorAssets +
      mediaDiagnostics.stats.warningAssets +
      mediaDiagnostics.stats.brokenUsages,
    productContentLinks: productContentLinks.length,
    productImages,
    rateLimitActiveBuckets: rateLimitBuckets.length,
    rateLimitBlocked: rateLimitBuckets.reduce(
      (total, bucket) => total + bucket.blocked,
      0,
    ),
  };

  return {
    cleanupLogs,
    cleanupPreview,
    cronRunLogs,
    healthItems: buildHealthItems({
      cleanupLogs,
      cleanupPreviewCandidates: stats.cleanupPreviewCandidates,
      cronRunLogs,
      mediaDiagnostics,
      rateLimitBuckets,
      stats,
    }),
    mediaDiagnostics,
    mediaReferences,
    productContentLinks,
    rateLimitBuckets,
    stats,
  };
}
