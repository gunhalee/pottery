import type { MediaDiagnosticsDashboard } from "@/lib/media/media-maintenance";
import type { CronRunLog } from "@/lib/ops/cron-run-log";
import type { RateLimitBucketSnapshot } from "@/lib/security/rate-limit";
import type { inspectOrphanUploads } from "@/lib/uploads/orphan-cleanup";

export type UploadCleanupLog = {
  bucket: string;
  createdAt: string;
  dryRun: boolean;
  errorMessage: string | null;
  id: number;
  reason: string;
  storagePath: string;
  success: boolean;
};

export type MediaReferenceItem = {
  bucket: string;
  createdAt?: string;
  ownerHref: string;
  ownerTitle: string;
  ownerType: "gallery" | "news" | "product";
  role: string;
  status: "attached" | "body-unlinked" | "referenced";
  storagePath: string;
};

export type ProductContentLinkItem = {
  contentHref: string;
  contentKind: "gallery" | "news";
  contentTitle: string;
  productSlug: string;
  productTitle: string;
  status: "linked" | "missing-product";
};

export type OperationsHealthItem = {
  detail: string;
  href?: string;
  label: string;
  status: "danger" | "neutral" | "warning";
};

export type OperationsDashboardData = {
  cleanupLogs: UploadCleanupLog[];
  cleanupPreview: Awaited<ReturnType<typeof inspectOrphanUploads>>;
  cronRunLogs: CronRunLog[];
  healthItems: OperationsHealthItem[];
  mediaDiagnostics: MediaDiagnosticsDashboard;
  mediaReferences: MediaReferenceItem[];
  productContentLinks: ProductContentLinkItem[];
  rateLimitBuckets: RateLimitBucketSnapshot[];
  stats: {
    bodyUnlinkedImages: number;
    cleanupFailures: number;
    cleanupPreviewCandidates: number;
    contentImages: number;
    cronFailures: number;
    mediaVariantIssues: number;
    productContentLinks: number;
    productImages: number;
    rateLimitActiveBuckets: number;
    rateLimitBlocked: number;
  };
};
