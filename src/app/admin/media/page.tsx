import { redirect } from "next/navigation";
import { regenerateMediaAssetVariantsAction } from "@/app/admin/actions";
import { AdminEmptyText } from "@/components/admin/admin-actions";
import { AdminMediaAssetThumbnail } from "@/components/admin/admin-media-thumbnail";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminStatCard } from "@/components/admin/admin-stat-card";
import { MediaVariantRegenerateSubmit } from "@/components/admin/media-variant-regenerate-submit";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  getMediaDiagnostics,
  type MediaAssetDiagnostic,
  type MediaDiagnosticIssue,
} from "@/lib/media/media-maintenance";
import type { MediaVariantName } from "@/lib/media/media-model";

type AdminMediaPageProps = {
  searchParams: Promise<{
    regenerate_error?: string;
    regenerated?: string;
  }>;
};

export const metadata = {
  title: "Media Library",
};

export default async function AdminMediaPage({
  searchParams,
}: AdminMediaPageProps) {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect("/admin/login?next=/admin/media");
  }

  const [diagnostics, flags] = await Promise.all([
    getMediaDiagnostics(),
    searchParams,
  ]);
  const problemAssets = diagnostics.assets.filter(
    (item) => item.health !== "ok",
  );
  const libraryAssets = diagnostics.assets.filter((item) => !item.asset.reserved);

  return (
    <main className="admin-page admin-media-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Consepot Admin</p>
          <h1>미디어</h1>
          <p>
            상품, 작업물, 소식에서 함께 쓰는 공용 이미지 asset을 진단하고,
            역할별 variant와 사용 상태를 확인합니다.
          </p>
        </div>
        <AdminNav />
      </header>

      {flags.regenerated ? (
        <div className="admin-alert">
          이미지 variant를 재생성했습니다. list, detail, thumbnail 이미지가 다시
          준비되었습니다.
        </div>
      ) : null}
      {flags.regenerate_error ? (
        <div className="admin-alert admin-alert-danger">
          <strong>variant 재생성에 실패했습니다.</strong>
          <span>{flags.regenerate_error}</span>
        </div>
      ) : null}

      <section className="admin-ops-stats" aria-label="미디어 진단 요약">
        <AdminStatCard label="전체 asset" value={diagnostics.stats.totalAssets} />
        <AdminStatCard
          label="정상"
          tone="neutral"
          value={diagnostics.stats.okAssets}
        />
        <AdminStatCard
          label="주의"
          tone={diagnostics.stats.warningAssets > 0 ? "warning" : "neutral"}
          value={diagnostics.stats.warningAssets}
        />
        <AdminStatCard
          label="오류"
          tone={diagnostics.stats.errorAssets > 0 ? "danger" : "neutral"}
          value={diagnostics.stats.errorAssets}
        />
        <AdminStatCard
          label="fallback usage"
          tone={diagnostics.stats.fallbackUsages > 0 ? "warning" : "neutral"}
          value={diagnostics.stats.fallbackUsages}
        />
        <AdminStatCard
          label="fallback detail"
          tone={
            diagnostics.stats.fallbackTargets.detail > 0 ? "warning" : "neutral"
          }
          value={diagnostics.stats.fallbackTargets.detail}
        />
        <AdminStatCard
          label="fallback list"
          tone={
            diagnostics.stats.fallbackTargets.list > 0 ? "warning" : "neutral"
          }
          value={diagnostics.stats.fallbackTargets.list}
        />
        <AdminStatCard
          label="cleanup 후보"
          tone={diagnostics.stats.orphanAssets > 0 ? "warning" : "neutral"}
          value={diagnostics.stats.orphanAssets}
        />
        <AdminStatCard
          label="broken usage"
          tone={diagnostics.stats.brokenUsages > 0 ? "danger" : "neutral"}
          value={diagnostics.stats.brokenUsages}
        />
        <AdminStatCard
          label="missing owner"
          tone={diagnostics.stats.ownerMissingUsages > 0 ? "danger" : "neutral"}
          value={diagnostics.stats.ownerMissingUsages}
        />
        <AdminStatCard
          label="shared path"
          tone={
            diagnostics.stats.sharedStoragePathAssets > 0
              ? "danger"
              : "neutral"
          }
          value={diagnostics.stats.sharedStoragePathAssets}
        />
      </section>

      <section className="admin-panel admin-media-integrity-list">
        <div className="admin-panel-head">
          <h2>Media usage integrity</h2>
          <span>{diagnostics.brokenUsages.length} rows</span>
        </div>
        {diagnostics.brokenUsages.length > 0 ? (
          <div className="admin-ops-table">
            {diagnostics.brokenUsages.map((usage) => (
              <article
                className="admin-ops-row admin-ops-row-danger"
                key={`${usage.id}-${usage.issue.code}`}
              >
                <div>
                  <strong>{usage.issue.title}</strong>
                  <span>{usage.issue.description}</span>
                </div>
                <code>{usage.assetId}</code>
                <span>
                  {usage.ownerType}:{usage.role}
                </span>
                <small>{usage.ownerId}</small>
              </article>
            ))}
          </div>
        ) : (
          <AdminEmptyText>
            media usage와 owner/asset 연결 문제가 없습니다.
          </AdminEmptyText>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>미디어 진단</h2>
          <span>{problemAssets.length} issues</span>
        </div>
        {problemAssets.length > 0 ? (
          <div className="admin-media-diagnostics-list">
            {problemAssets.map((item) => (
              <MediaDiagnosticCard item={item} key={item.asset.id} />
            ))}
          </div>
        ) : (
          <AdminEmptyText>
            현재 진단 가능한 미디어 문제는 없습니다.
          </AdminEmptyText>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>라이브러리</h2>
          <span>{libraryAssets.length} assets</span>
        </div>
        {libraryAssets.length > 0 ? (
          <div className="admin-media-library-grid">
            {libraryAssets.map((item) => (
              <MediaLibraryItem item={item} key={item.asset.id} />
            ))}
          </div>
        ) : (
          <AdminEmptyText>
            아직 등록된 미디어가 없습니다.
          </AdminEmptyText>
        )}
      </section>
    </main>
  );
}

function MediaDiagnosticCard({ item }: { item: MediaAssetDiagnostic }) {
  return (
    <article
      className={`admin-media-diagnostic-card admin-media-health-${item.health}`}
      id={`asset-${item.asset.id}`}
    >
      <AdminMediaAssetThumbnail asset={item.asset} />
      <div>
        <strong>{item.asset.artworkTitle ?? item.asset.alt}</strong>
        <span>
          {item.asset.usageCount} usages · {item.asset.masterPath}
        </span>
        <ul>
          {item.issues.map((issue) => (
            <li key={`${item.asset.id}-${issue.code}`}>
              <b>{issue.title}</b>
              <span>{issue.description}</span>
              <small>{getIssueActionHint(issue)}</small>
            </li>
          ))}
        </ul>
        <div className="admin-media-variant-grid">
          {getVariantRows(item).map((variant) => (
            <div
              className={`admin-media-variant-row ${
                variant.ready
                  ? "admin-media-variant-row-ok"
                  : "admin-media-variant-row-missing"
              }`}
              key={`${item.asset.id}-${variant.name}`}
            >
              <span>{variant.label}</span>
              <strong>{variant.ready ? "준비됨" : "누락"}</strong>
              <code>{variant.path ?? "storage path 없음"}</code>
            </div>
          ))}
        </div>
        {item.fallbackUsages.length > 0 ? (
          <div className="admin-media-fallback-list">
            <strong>role fallback details</strong>
            {item.fallbackUsages.map((usage) => (
              <div
                className="admin-media-fallback-row"
                key={`${item.asset.id}-${usage.usageId}`}
              >
                <span>
                  {usage.ownerType}:{usage.role}
                </span>
                <code>
                  {usage.expectedSurface} -&gt; {usage.selectedVariant}
                </code>
                <small>{usage.ownerId}</small>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <RegenerateForm
        assetId={item.asset.id}
        disabled={!item.canRegenerate}
        disabledReason={getRegenerateDisabledReason(item)}
        returnTo={`/admin/media#asset-${item.asset.id}`}
      />
    </article>
  );
}

function MediaLibraryItem({ item }: { item: MediaAssetDiagnostic }) {
  return (
    <article
      className={`admin-media-library-item admin-media-health-${item.health}`}
      id={`library-asset-${item.asset.id}`}
    >
      <AdminMediaAssetThumbnail asset={item.asset} />
      <div>
        <strong>{item.asset.artworkTitle ?? item.asset.alt}</strong>
        <span>{item.asset.usageCount} usages</span>
        <span>{mediaHealthLabel(item.health)}</span>
        {item.asset.reserved ? <span>보관</span> : null}
      </div>
      <code>{item.asset.masterPath}</code>
      {item.health !== "ok" ? (
        <RegenerateForm
          assetId={item.asset.id}
          disabled={!item.canRegenerate}
          disabledReason={getRegenerateDisabledReason(item)}
          returnTo={`/admin/media#library-asset-${item.asset.id}`}
        />
      ) : null}
    </article>
  );
}

function RegenerateForm({
  assetId,
  disabled,
  disabledReason,
  returnTo,
}: {
  assetId: string;
  disabled: boolean;
  disabledReason?: string;
  returnTo: string;
}) {
  return (
    <form
      action={regenerateMediaAssetVariantsAction}
      className="admin-regenerate-form"
    >
      <input name="assetId" type="hidden" value={assetId} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <MediaVariantRegenerateSubmit disabled={disabled} />
      {disabledReason ? (
        <p className="admin-regenerate-help">{disabledReason}</p>
      ) : null}
    </form>
  );
}

function getRegenerateDisabledReason(item: MediaAssetDiagnostic) {
  if (item.canRegenerate) {
    return undefined;
  }

  if (!item.asset.masterPath) {
    return "원본 이미지 경로가 없어 재생성할 수 없습니다. 실제 이미지를 다시 업로드한 뒤 시도하세요.";
  }

  if (item.asset.bucket !== "media-assets") {
    return "media-assets 버킷의 이미지가 아니어서 자동 재생성을 실행할 수 없습니다.";
  }

  return "이 asset은 현재 variant 재생성을 실행할 수 없습니다.";
}

function getIssueActionHint(issue: MediaDiagnosticIssue) {
  return {
    broken_usage:
      "연결 정보만 남은 상태입니다. 원본 asset을 복구하거나 연결을 정리해야 합니다.",
    duplicate_variant_path:
      "예상 master mirror가 아니라면 DB variant path를 확인한 뒤 재생성하세요.",
    master_missing:
      "원본 파일이 없는 asset입니다. 실제 이미지를 다시 업로드해야 합니다.",
    orphan_asset:
      "어디에도 연결되지 않은 asset입니다. 필요 없으면 cleanup 대상으로 처리할 수 있습니다.",
    role_variant_fallback:
      "공개 화면에서 역할에 맞는 list/detail variant를 쓰도록 재생성하세요.",
    owner_missing:
      "media usage만 남아 있는 상태입니다. owner row를 복구하거나 usage를 정리해야 합니다.",
    shared_storage_path:
      "여러 asset이 같은 storage path를 공유합니다. asset별 원본/variant 경로를 분리해야 합니다.",
    variant_missing:
      "재생성 버튼으로 master/detail/list/thumbnail webp를 다시 만들 수 있습니다.",
  }[issue.code];
}

function getVariantRows(item: MediaAssetDiagnostic) {
  const variants: Array<{ label: string; name: MediaVariantName }> = [
    { label: "master", name: "master" },
    { label: "detail", name: "detail" },
    { label: "list", name: "list" },
    { label: "thumbnail", name: "thumbnail" },
  ];

  return variants.map(({ label, name }) => {
    const variant = item.asset.variants.find((entry) => entry.variant === name);
    const path =
      name === "master"
        ? item.asset.masterPath || variant?.storagePath
        : variant?.storagePath;

    return {
      label,
      name,
      path,
      ready: Boolean(path),
    };
  });
}

function mediaHealthLabel(health: MediaAssetDiagnostic["health"]) {
  return {
    error: "오류",
    ok: "정상",
    warning: "주의",
  }[health];
}
