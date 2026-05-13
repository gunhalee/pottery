import "server-only";

import type { MediaDiagnosticsDashboard } from "@/lib/media/media-maintenance";
import type { CronRunLog } from "@/lib/ops/cron-run-log";
import type { RateLimitBucketSnapshot } from "@/lib/security/rate-limit";
import type {
  OperationsDashboardData,
  OperationsHealthItem,
  UploadCleanupLog,
} from "./types";

export function buildHealthItems({
  cleanupLogs,
  cleanupPreviewCandidates,
  cronRunLogs,
  mediaDiagnostics,
  rateLimitBuckets,
  stats,
}: {
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
  ];
}

function isWithinHours(value: string, hours: number) {
  const timestamp = new Date(value).getTime();

  return (
    Number.isFinite(timestamp) &&
    Date.now() - timestamp <= hours * 60 * 60 * 1000
  );
}
