import { redirect } from "next/navigation";
import { regenerateMediaAssetVariantsAction } from "@/app/admin/actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { MediaVariantRegenerateSubmit } from "@/components/admin/media-variant-regenerate-submit";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  getMediaDiagnostics,
  type MediaAssetDiagnostic,
} from "@/lib/media/media-maintenance";
import { pickMediaVariantForSurface } from "@/lib/media/media-variant-policy";

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

  return (
    <main className="admin-page admin-media-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Consepot Admin</p>
          <h1>미디어</h1>
          <p>
            상품, 작품, 소식에서 함께 쓰는 공용 이미지 asset을 진단하고,
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
        <StatCard label="전체 asset" value={diagnostics.stats.totalAssets} />
        <StatCard
          label="정상"
          tone="neutral"
          value={diagnostics.stats.okAssets}
        />
        <StatCard
          label="주의"
          tone={diagnostics.stats.warningAssets > 0 ? "warning" : "neutral"}
          value={diagnostics.stats.warningAssets}
        />
        <StatCard
          label="오류"
          tone={diagnostics.stats.errorAssets > 0 ? "danger" : "neutral"}
          value={diagnostics.stats.errorAssets}
        />
        <StatCard
          label="fallback usage"
          tone={diagnostics.stats.fallbackUsages > 0 ? "warning" : "neutral"}
          value={diagnostics.stats.fallbackUsages}
        />
        <StatCard
          label="cleanup 후보"
          tone={diagnostics.stats.orphanAssets > 0 ? "warning" : "neutral"}
          value={diagnostics.stats.orphanAssets}
        />
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
          <p className="admin-empty-text">
            현재 진단 가능한 미디어 문제는 없습니다.
          </p>
        )}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>라이브러리</h2>
          <span>{diagnostics.assets.length} assets</span>
        </div>
        {diagnostics.assets.length > 0 ? (
          <div className="admin-media-library-grid">
            {diagnostics.assets.map((item) => (
              <MediaLibraryItem item={item} key={item.asset.id} />
            ))}
          </div>
        ) : (
          <p className="admin-empty-text">
            아직 등록된 미디어가 없습니다.
          </p>
        )}
      </section>
    </main>
  );
}

function MediaDiagnosticCard({ item }: { item: MediaAssetDiagnostic }) {
  const thumbnail = pickMediaVariantForSurface(item.asset, "thumbnail");

  return (
    <article
      className={`admin-media-diagnostic-card admin-media-health-${item.health}`}
      id={`asset-${item.asset.id}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={item.asset.alt} src={thumbnail?.src ?? item.asset.src} />
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
            </li>
          ))}
        </ul>
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
  const thumbnail = pickMediaVariantForSurface(item.asset, "thumbnail");

  return (
    <article
      className={`admin-media-library-item admin-media-health-${item.health}`}
      id={`library-asset-${item.asset.id}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={item.asset.alt} src={thumbnail?.src ?? item.asset.src} />
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

function mediaHealthLabel(health: MediaAssetDiagnostic["health"]) {
  return {
    error: "오류",
    ok: "정상",
    warning: "주의",
  }[health];
}
