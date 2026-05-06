import "server-only";

import {
  readContentEntries,
  getContentAdminPath,
} from "@/lib/content-manager/content-store";
import { mediaAssetBucket } from "@/lib/media/media-store";
import {
  getMediaDiagnostics,
  type MediaDiagnosticsDashboard,
} from "@/lib/media/media-maintenance";
import {
  readCronRunLogs,
  type CronRunLog,
} from "@/lib/ops/cron-run-log";
import {
  readRateLimitBuckets,
  type RateLimitBucketSnapshot,
} from "@/lib/security/rate-limit";
import { walkLexicalNodes } from "@/lib/content-manager/rich-text-utils";
import { readProducts } from "@/lib/shop/product-store";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { inspectOrphanUploads } from "@/lib/uploads/orphan-cleanup";

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

export type Cafe24SyncLogItem = {
  action: "manual_mapping" | "preview" | "sync";
  createdAt: string;
  id: number;
  message: string | null;
  productHref: string;
  productId: string;
  productSlug: string | null;
  productTitle: string;
  status: "failed" | "preview" | "success";
};

export type OperationsDashboardData = {
  cafe24SyncLogs: Cafe24SyncLogItem[];
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
    cafe24SyncFailures: number;
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

type ProductSyncLogRow = {
  action: Cafe24SyncLogItem["action"];
  created_at: string;
  id: number;
  message: string | null;
  product_id: string;
  request_payload: unknown;
  response_payload: unknown;
  status: Cafe24SyncLogItem["status"];
};

export async function getOperationsDashboardData(): Promise<OperationsDashboardData> {
  const [
    cafe24SyncLogRows,
    cleanupLogs,
    cleanupPreview,
    cronRunLogs,
    products,
    rateLimitBuckets,
    entries,
    mediaDiagnostics,
  ] = await Promise.all([
    readCafe24SyncLogs(),
    readUploadCleanupLogs(),
    inspectOrphanUploads({ maxCandidates: 30, minAgeHours: 48 }),
    readCronRunLogs(),
    readProducts(),
    readRateLimitBuckets(),
    readContentEntries(),
    getMediaDiagnostics(120),
  ]);
  const productBySlug = new Map(products.map((product) => [product.slug, product]));
  const productById = new Map(products.map((product) => [product.id, product]));
  const cafe24SyncLogs = cafe24SyncLogRows.map((log) => {
    const product = productById.get(log.product_id);

    return {
      action: log.action,
      createdAt: log.created_at,
      id: log.id,
      message: log.message,
      productHref: product ? `/admin/products/${product.id}` : "/admin/products",
      productId: log.product_id,
      productSlug: product?.slug ?? null,
      productTitle: product?.titleKo ?? "삭제되었거나 찾을 수 없는 상품",
      status: log.status,
    } satisfies Cafe24SyncLogItem;
  });
  const mediaReferences: MediaReferenceItem[] = [];
  const productContentLinks: ProductContentLinkItem[] = [];

  for (const product of products) {
    for (const [index, image] of product.images.entries()) {
      if (!image.storagePath) {
        continue;
      }

      const roles = [
        image.isPrimary ? "대표" : null,
        image.isListImage ? "목록" : null,
        image.isDetail ? "상세 갤러리" : null,
        image.isDescription ? "설명 삽입" : null,
      ].filter((role): role is string => Boolean(role));

      mediaReferences.push({
        bucket: mediaAssetBucket,
        ownerHref: `/admin/products/${product.id}`,
        ownerTitle: product.titleKo,
        ownerType: "product",
        role: roles.join(" / ") || (index === 0 ? "첨부" : "상세 이미지"),
        status: "referenced",
        storagePath: image.storagePath,
      });
    }
  }

  for (const entry of entries) {
    const imageIdsInBody = new Set(
      walkLexicalNodes(entry.body)
        .filter((node) => node.type === "content-image")
        .map((node) => node.id)
        .filter((id): id is string => typeof id === "string"),
    );

    for (const image of entry.images) {
      const roles = [
        image.isCover ? "대표" : null,
        image.isListImage ? "목록" : null,
        image.isDetail ? "상세 하단" : null,
        image.isReserved ? "보관" : null,
        imageIdsInBody.has(image.id) ? "본문" : null,
      ].filter((role): role is string => Boolean(role));

      mediaReferences.push({
        bucket: mediaAssetBucket,
        createdAt: image.createdAt,
        ownerHref: `${getContentAdminPath(entry.kind)}/${entry.id}`,
        ownerTitle: entry.title,
        ownerType: entry.kind,
        role: roles.join(" / ") || "첨부만 됨",
        status:
          roles.length > 0
            ? "referenced"
            : entry.status === "draft"
              ? "attached"
              : "body-unlinked",
        storagePath: image.storagePath,
      });
    }

    if (entry.relatedProductSlug) {
      const product = productBySlug.get(entry.relatedProductSlug);

      productContentLinks.push({
        contentHref: `${getContentAdminPath(entry.kind)}/${entry.id}`,
        contentKind: entry.kind,
        contentTitle: entry.title,
        productSlug: entry.relatedProductSlug,
        productTitle: product?.titleKo ?? "연결 상품 없음",
        status: product ? "linked" : "missing-product",
      });
    }
  }

  const productImages = mediaReferences.filter(
    (item) => item.ownerType === "product",
  ).length;
  const contentImages = mediaReferences.length - productImages;
  const stats = {
    bodyUnlinkedImages: mediaReferences.filter(
      (item) => item.status === "body-unlinked",
    ).length,
    cafe24SyncFailures: cafe24SyncLogs.filter((log) => log.status === "failed")
      .length,
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
    cafe24SyncLogs,
    cleanupLogs,
    cleanupPreview,
    cronRunLogs,
    healthItems: buildHealthItems({
      cafe24SyncLogs,
      cleanupLogs,
      cleanupPreviewCandidates: stats.cleanupPreviewCandidates,
      cronRunLogs,
      mediaDiagnostics,
      rateLimitBuckets,
      stats,
    }),
    mediaDiagnostics,
    mediaReferences: mediaReferences.sort((a, b) =>
      a.ownerTitle.localeCompare(b.ownerTitle, "ko-KR"),
    ),
    productContentLinks,
    rateLimitBuckets,
    stats,
  };
}

function buildHealthItems({
  cafe24SyncLogs,
  cleanupLogs,
  cleanupPreviewCandidates,
  cronRunLogs,
  mediaDiagnostics,
  rateLimitBuckets,
  stats,
}: {
  cafe24SyncLogs: Cafe24SyncLogItem[];
  cleanupLogs: UploadCleanupLog[];
  cleanupPreviewCandidates: number;
  cronRunLogs: CronRunLog[];
  mediaDiagnostics: MediaDiagnosticsDashboard;
  rateLimitBuckets: RateLimitBucketSnapshot[];
  stats: OperationsDashboardData["stats"];
}): OperationsHealthItem[] {
  const recentCleanupFailures = cleanupLogs.filter(
    (log) => !log.success && isWithinHours(log.createdAt, 24),
  );
  const recentCafe24Failures = cafe24SyncLogs.filter(
    (log) => log.status === "failed" && isWithinHours(log.createdAt, 24),
  );
  const recentCronFailures = cronRunLogs.filter(
    (log) => log.status === "failed" && isWithinHours(log.startedAt, 24),
  );
  const staleCronRuns = cronRunLogs.filter(
    (log) =>
      log.status === "running" &&
      Date.now() - new Date(log.startedAt).getTime() > 10 * 60 * 1000,
  );
  const mediaErrors =
    mediaDiagnostics.stats.errorAssets + mediaDiagnostics.stats.brokenUsages;
  const blockedRateLimitRequests = rateLimitBuckets.reduce(
    (total, bucket) => total + bucket.blocked,
    0,
  );

  return [
    {
      detail:
        recentCleanupFailures.length > 0
          ? `${recentCleanupFailures.length}건의 최근 cleanup 실패가 있습니다.`
          : cleanupPreviewCandidates > 0
            ? `${cleanupPreviewCandidates}건의 cleanup 후보가 대기 중입니다.`
            : "최근 cleanup 실패나 대기 후보가 없습니다.",
      label: "업로드 cleanup",
      status:
        recentCleanupFailures.length > 0
          ? "danger"
          : cleanupPreviewCandidates > 0
            ? "warning"
            : "neutral",
    },
    {
      detail:
        mediaErrors > 0
          ? `${mediaErrors}건의 심각한 미디어 참조/variant 문제가 있습니다.`
          : stats.mediaVariantIssues > 0
            ? `${stats.mediaVariantIssues}건의 미디어 경고가 있습니다.`
            : "미디어 참조와 variant 상태가 정상입니다.",
      href: "/admin/media",
      label: "미디어 라이브러리",
      status:
        mediaErrors > 0
          ? "danger"
          : stats.mediaVariantIssues > 0
            ? "warning"
            : "neutral",
    },
    {
      detail:
        blockedRateLimitRequests > 0
          ? `${blockedRateLimitRequests}건의 최근 rate limit 차단이 있습니다.`
          : rateLimitBuckets.length > 0
            ? "최근 rate limit 버킷에 차단된 요청이 없습니다."
            : "아직 rate limit 기록이 없습니다.",
      label: "Rate limit",
      status: blockedRateLimitRequests > 0 ? "warning" : "neutral",
    },
    {
      detail:
        staleCronRuns.length > 0
          ? `${staleCronRuns.length}건의 cron 실행이 10분 넘게 running 상태입니다.`
          : recentCronFailures.length > 0
            ? `${recentCronFailures.length}건의 최근 cron 실행 실패가 있습니다.`
            : cronRunLogs.length > 0
              ? "최근 cron 실행 로그에 즉시 조치할 실패가 없습니다."
              : "아직 cron 실행 로그가 없습니다.",
      label: "Cron 실행",
      status:
        staleCronRuns.length > 0 || recentCronFailures.length > 0
          ? "danger"
          : "neutral",
    },
    {
      detail:
        recentCafe24Failures.length > 0
          ? `${recentCafe24Failures.length}건의 최근 Cafe24 동기화 실패가 있습니다.`
          : cafe24SyncLogs.length > 0
            ? "최근 Cafe24 동기화 로그에 즉시 조치할 실패가 없습니다."
            : "아직 Cafe24 동기화 로그가 없습니다.",
      href: "/admin/products",
      label: "Cafe24 동기화",
      status: recentCafe24Failures.length > 0 ? "danger" : "neutral",
    },
  ];
}

async function readCafe24SyncLogs(limit = 30): Promise<ProductSyncLogRow[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_product_sync_logs")
    .select(
      "id, product_id, action, status, message, request_payload, response_payload, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingProductSyncLogTableError(error)) {
      return [];
    }

    throw new Error(`Failed to read Cafe24 sync logs: ${error.message}`);
  }

  return (data ?? []) as ProductSyncLogRow[];
}

async function readUploadCleanupLogs(limit = 40): Promise<UploadCleanupLog[]> {
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

function isMissingProductSyncLogTableError(error: { message?: string }) {
  const message = error.message ?? "";
  return (
    message.includes("shop_product_sync_logs") &&
    (message.includes("schema cache") || message.includes("does not exist"))
  );
}

function isWithinHours(value: string, hours: number) {
  const timestamp = new Date(value).getTime();

  return (
    Number.isFinite(timestamp) &&
    Date.now() - timestamp <= hours * 60 * 60 * 1000
  );
}
