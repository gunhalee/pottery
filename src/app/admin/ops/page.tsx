import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { getOperationsDashboardData } from "@/lib/admin/operations";

export const metadata = {
  title: "Operations Admin",
};

export default async function AdminOpsPage() {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect("/admin/login?next=/admin/ops");
  }

  const dashboard = await getOperationsDashboardData();

  return (
    <main className="admin-page admin-ops-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Consepot Admin</p>
          <h1>운영 점검</h1>
          <p>
            업로드 cleanup, 미디어 참조, 상품-콘텐츠 연결 상태를
            한 곳에서 확인합니다.
          </p>
        </div>
        <AdminNav />
      </header>

      <section className="admin-ops-stats" aria-label="운영 요약">
        <StatCard label="상품 이미지" value={dashboard.stats.productImages} />
        <StatCard label="본문/작업물 이미지" value={dashboard.stats.contentImages} />
        <StatCard
          label="cleanup 후보"
          value={dashboard.stats.cleanupPreviewCandidates}
        />
        <StatCard label="연결 콘텐츠" value={dashboard.stats.productContentLinks} />
        <StatCard
          label="본문 미연결"
          tone={dashboard.stats.bodyUnlinkedImages > 0 ? "warning" : "neutral"}
          value={dashboard.stats.bodyUnlinkedImages}
        />
        <StatCard
          label="cleanup 실패"
          tone={dashboard.stats.cleanupFailures > 0 ? "danger" : "neutral"}
          value={dashboard.stats.cleanupFailures}
        />
        <StatCard
          label="Cron 실패"
          tone={dashboard.stats.cronFailures > 0 ? "danger" : "neutral"}
          value={dashboard.stats.cronFailures}
        />
        <StatCard
          label="Rate limit 차단"
          tone={dashboard.stats.rateLimitBlocked > 0 ? "warning" : "neutral"}
          value={dashboard.stats.rateLimitBlocked}
        />
        <StatCard
          label="미디어 이슈"
          tone={dashboard.stats.mediaVariantIssues > 0 ? "warning" : "neutral"}
          value={dashboard.stats.mediaVariantIssues}
        />
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>운영 상태</h2>
          <span>최근 24시간 실패 기준</span>
        </div>
        <div className="admin-ops-table">
          {dashboard.healthItems.map((item) => (
            <article
              className={`admin-ops-row admin-ops-row-${item.status}`}
              key={item.label}
            >
              <div>
                <strong>{item.label}</strong>
                {item.href ? (
                  <Link href={item.href} prefetch={false}>
                    관련 화면 열기
                  </Link>
                ) : null}
              </div>
              <span>{healthStatusLabel(item.status)}</span>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Rate limit 버킷</h2>
          <span>최근 {dashboard.rateLimitBuckets.length}개</span>
        </div>
        {dashboard.rateLimitBuckets.length > 0 ? (
          <div className="admin-ops-table">
            {dashboard.rateLimitBuckets.map((bucket) => (
              <article
                className={`admin-ops-row ${
                  bucket.blocked > 0 ? "admin-ops-row-warning" : ""
                }`}
                key={`${bucket.namespace}:${bucket.keyHash}:${bucket.windowStart}`}
              >
                <div>
                  <strong>{bucket.namespace}</strong>
                  <span>{formatRateLimitWindow(bucket.windowSeconds)}</span>
                </div>
                <code>{bucket.keyHash.slice(0, 12)}</code>
                <span>
                  {bucket.count}/{bucket.limit}
                </span>
                <span>
                  {bucket.blocked > 0
                    ? `${bucket.blocked}건 차단`
                    : `${bucket.remaining}건 남음`}
                </span>
                <time dateTime={bucket.updatedAt}>
                  {formatDateTime(bucket.updatedAt)}
                </time>
              </article>
            ))}
          </div>
        ) : (
          <p className="admin-empty-text">아직 rate limit 기록이 없습니다.</p>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Cron 실행 로그</h2>
          <span>최근 {dashboard.cronRunLogs.length}건</span>
        </div>
        {dashboard.cronRunLogs.length > 0 ? (
          <div className="admin-ops-table">
            {dashboard.cronRunLogs.map((log) => (
              <article
                className={`admin-ops-row ${
                  log.status === "failed"
                    ? "admin-ops-row-danger"
                    : log.status === "running"
                      ? "admin-ops-row-warning"
                      : ""
                }`}
                key={log.id}
              >
                <div>
                  <strong>{cronJobLabel(log.jobName)}</strong>
                  <span>{log.triggerSource}</span>
                </div>
                <span>{cronStatusLabel(log.status)}</span>
                <span>{formatDuration(log.durationMs)}</span>
                <time dateTime={log.startedAt}>{formatDateTime(log.startedAt)}</time>
                {log.errorMessage ? <p>{log.errorMessage}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="admin-empty-text">아직 cron 실행 로그가 없습니다.</p>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>미디어 진단 요약</h2>
          <Link className="admin-text-button" href="/admin/media" prefetch={false}>
            미디어에서 보기
          </Link>
        </div>
        <div className="admin-ops-table">
          <article
            className={`admin-ops-row ${
              dashboard.mediaDiagnostics.stats.errorAssets > 0
                ? "admin-ops-row-danger"
                : ""
            }`}
          >
            <div>
              <strong>variant 오류 asset</strong>
              <span>master/detail/list/thumbnail 구성 확인</span>
            </div>
            <span>{dashboard.mediaDiagnostics.stats.errorAssets}</span>
          </article>
          <article
            className={`admin-ops-row ${
              dashboard.mediaDiagnostics.stats.fallbackUsages > 0
                ? "admin-ops-row-warning"
                : ""
            }`}
          >
            <div>
              <strong>fallback usage</strong>
              <span>역할에 맞는 variant 대신 대체 이미지를 쓰는 참조</span>
            </div>
            <span>{dashboard.mediaDiagnostics.stats.fallbackUsages}</span>
          </article>
          <article
            className={`admin-ops-row ${
              dashboard.mediaDiagnostics.stats.orphanAssets > 0
                ? "admin-ops-row-warning"
                : ""
            }`}
          >
            <div>
              <strong>미사용 asset</strong>
              <span>어디에도 연결되지 않아 cleanup 후보가 될 수 있음</span>
            </div>
            <span>{dashboard.mediaDiagnostics.stats.orphanAssets}</span>
          </article>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>업로드 cleanup 로그</h2>
          <span>최근 {dashboard.cleanupLogs.length}건</span>
        </div>
        {dashboard.cleanupLogs.length > 0 ? (
          <div className="admin-ops-table">
            {dashboard.cleanupLogs.map((log) => (
              <article
                className={`admin-ops-row ${
                  log.success ? "" : "admin-ops-row-danger"
                }`}
                key={log.id}
              >
                <div>
                  <strong>{log.reason}</strong>
                  <span>{log.bucket}</span>
                </div>
                <code>{log.storagePath}</code>
                <span>{log.dryRun ? "dry-run" : "delete"}</span>
                <span>{log.success ? "성공" : "실패"}</span>
                <time dateTime={log.createdAt}>{formatDateTime(log.createdAt)}</time>
                {log.errorMessage ? <p>{log.errorMessage}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="admin-empty-text">아직 cleanup 로그가 없습니다.</p>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>다음 cleanup 후보</h2>
          <span>{dashboard.cleanupPreview.minAgeHours}시간 이상 미참조</span>
        </div>
        {dashboard.cleanupPreview.candidates.length > 0 ? (
          <div className="admin-ops-table">
            {dashboard.cleanupPreview.candidates.map((candidate) => (
              <article
                className="admin-ops-row admin-ops-row-warning"
                key={`${candidate.bucket}:${candidate.storagePath}`}
              >
                <div>
                  <strong>{candidate.reason}</strong>
                  <span>{candidate.bucket}</span>
                </div>
                <code>{candidate.storagePath}</code>
                <span>{formatDateTime(candidate.timestamp)}</span>
              </article>
            ))}
          </div>
        ) : (
          <p className="admin-empty-text">현재 cleanup 후보가 없습니다.</p>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>미디어 참조</h2>
          <span>{dashboard.mediaReferences.length} items</span>
        </div>
        <div className="admin-ops-table">
          {dashboard.mediaReferences.map((item) => (
            <article
              className={`admin-ops-row admin-media-status-${item.status}`}
              key={`${item.bucket}:${item.storagePath}`}
            >
              <div>
                <strong>{item.ownerTitle}</strong>
                <Link href={item.ownerHref} prefetch={false}>
                  {ownerTypeLabel(item.ownerType)}
                </Link>
              </div>
              <code>{item.storagePath}</code>
              <span>{item.role}</span>
              <span>{mediaStatusLabel(item.status)}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>상품-작업물 연결</h2>
          <span>{dashboard.productContentLinks.length} links</span>
        </div>
        {dashboard.productContentLinks.length > 0 ? (
          <div className="admin-ops-table">
            {dashboard.productContentLinks.map((item) => (
              <article
                className={`admin-ops-row admin-link-status-${item.status}`}
                key={`${item.contentKind}:${item.contentHref}:${item.productSlug}`}
              >
                <div>
                  <strong>{item.contentTitle}</strong>
                  <Link href={item.contentHref} prefetch={false}>
                    {item.contentKind === "gallery" ? "작업물" : "소식"}
                  </Link>
                </div>
                <span>{item.productTitle}</span>
                <code>{item.productSlug}</code>
                <span>{item.status === "linked" ? "연결됨" : "상품 없음"}</span>
              </article>
            ))}
          </div>
        ) : (
          <p className="admin-empty-text">
            아직 상품과 연결된 작업물/소식이 없습니다.
          </p>
        )}
      </section>
    </main>
  );
}

function StatCard({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "danger" | "neutral" | "warning";
  value: number;
}) {
  return (
    <article className={`admin-ops-stat admin-ops-stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ownerTypeLabel(type: "gallery" | "news" | "product") {
  return {
    gallery: "작업물",
    news: "소식",
    product: "상품",
  }[type];
}

function mediaStatusLabel(status: "attached" | "body-unlinked" | "referenced") {
  return {
    attached: "draft 첨부",
    "body-unlinked": "본문 미연결",
    referenced: "참조 중",
  }[status];
}

function healthStatusLabel(status: "danger" | "neutral" | "warning") {
  return {
    danger: "확인 필요",
    neutral: "정상",
    warning: "주의",
  }[status];
}

function cronJobLabel(jobName: "order_notifications" | "upload_cleanup") {
  return {
    order_notifications: "주문 알림",
    upload_cleanup: "업로드 cleanup",
  }[jobName];
}

function cronStatusLabel(status: "failed" | "running" | "success") {
  return {
    failed: "실패",
    running: "실행 중",
    success: "성공",
  }[status];
}

function formatDuration(value: number | null) {
  if (value === null) {
    return "-";
  }

  if (value < 1000) {
    return `${value}ms`;
  }

  return `${(value / 1000).toFixed(1)}s`;
}

function formatRateLimitWindow(seconds: number) {
  if (seconds < 60) {
    return `${seconds}초`;
  }

  if (seconds < 60 * 60) {
    return `${Math.round(seconds / 60)}분`;
  }

  return `${Math.round(seconds / 3600)}시간`;
}

function formatDateTime(value: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
