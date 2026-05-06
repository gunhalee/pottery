import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  deleteProductAction,
  saveCafe24MappingAction,
  syncProductToCafe24Action,
  updateProductAction,
} from "../../actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminSuccessNotice } from "@/components/admin/admin-success-notice";
import { ProductImageManager } from "@/components/admin/product-image-manager";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  getProductById,
  getProductPurchaseHref,
  getProductPurchaseKind,
  readProductSyncLogs,
  type ConsepotProduct,
  type ProductSyncLog,
} from "@/lib/shop";
import { buildCafe24SyncPreview } from "@/lib/cafe24/product-sync";
import {
  buildCafe24ProductReadiness,
  type Cafe24ProductReadiness,
} from "@/lib/cafe24/product-status";
import {
  getCafe24ConnectionStatus,
  type Cafe24ConnectionStatus,
} from "@/lib/cafe24/oauth";
import { readMediaLibraryAssets } from "@/lib/media/media-store";

type AdminProductEditPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    created?: string;
    delete_error?: string;
    image_delete_error?: string;
    image_deleted?: string;
    mapping_saved?: string;
    publish_error?: string;
    saved?: string;
    sync_error?: string;
    synced?: string;
  }>;
};

export const metadata = {
  title: "Edit Product",
};

export default async function AdminProductEditPage({
  params,
  searchParams,
}: AdminProductEditPageProps) {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect("/admin/login?next=/admin/products");
  }

  const { id } = await params;
  const flags = await searchParams;
  const product = await getProductById(id);

  if (!product) {
    notFound();
  }

  const [preview, readiness, syncLogs, cafe24Connection, mediaAssets] =
    await Promise.all([
      buildCafe24SyncPreview(product),
      buildCafe24ProductReadiness(product),
      readProductSyncLogs(product.id),
      getCafe24ConnectionStatus(),
      readMediaLibraryAssets(120),
    ]);
  const adminWarnings = getAdminWarnings(product, preview.warnings);
  const publicHref = product.published ? `/shop/${product.slug}` : null;

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Consepot Admin</p>
          <h1>{product.titleKo}</h1>
          <p>
            본 사이트의 상품 원장을 수정합니다. 저장 후 Cafe24 동기화 버튼으로
            결제용 상품 정보를 밀어넣습니다.
          </p>
        </div>
        <div className="admin-header-actions">
          <Link className="admin-text-button" href="/admin/products">
            목록
          </Link>
          <AdminNav />
        </div>
      </header>

      {flags.created ? (
        <AdminSuccessNotice
          description="상품 초안을 만들었습니다. 공개 체크 후 저장하면 공개 상품 링크가 표시됩니다."
          key={`product-created-${product.id}`}
          title="초안을 만들었습니다."
        />
      ) : null}
      {flags.saved ? (
        <AdminSuccessNotice
          description={
            publicHref
              ? "상품을 저장했고 공개 페이지에 반영했습니다. 고객 화면을 바로 확인할 수 있습니다."
              : "상품을 저장했습니다. 아직 공개 전이라 공개 상품 링크는 표시하지 않습니다."
          }
          key={`product-saved-${product.updatedAt}`}
          primaryHref={publicHref}
          primaryLabel="공개 상품 보기"
          title="저장했습니다."
        />
      ) : null}
      {flags.mapping_saved ? (
        <AdminSuccessNotice
          description="Cafe24 상품번호, 품목코드, 주문서 URL 등 매핑 정보를 저장했습니다."
          key={`product-mapping-${product.updatedAt}`}
          title="Cafe24 매핑 정보를 저장했습니다."
        />
      ) : null}
      {flags.image_deleted ? (
        <div className="admin-alert">상품 이미지를 삭제했습니다.</div>
      ) : null}
      {flags.image_delete_error ? (
        <div className="admin-alert admin-alert-danger">
          삭제할 상품 이미지를 찾을 수 없습니다.
        </div>
      ) : null}
      {flags.publish_error ? (
        <div className="admin-alert admin-alert-danger">
          {getProductPublishErrorMessage(flags.publish_error)}
        </div>
      ) : null}
      {flags.synced ? (
        <AdminSuccessNotice
          description="Cafe24로 상품 정보를 보냈습니다. 최근 로그에서 응답 상태를 함께 확인할 수 있습니다."
          key={`product-synced-${product.updatedAt}`}
          primaryHref={publicHref}
          primaryLabel="공개 상품 보기"
          title="Cafe24 상품 동기화를 완료했습니다."
        />
      ) : null}
      {flags.sync_error ? (
        <div className="admin-alert admin-alert-danger">
          Cafe24 동기화 실패: {flags.sync_error}
        </div>
      ) : null}
      {flags.delete_error ? (
        <div className="admin-alert admin-alert-danger">
          삭제 확인 문구가 상품 slug와 일치하지 않습니다.
        </div>
      ) : null}
      {adminWarnings.length > 0 ? (
        <div className="admin-alert admin-alert-warning">
          <strong>확인할 항목</strong>
          {adminWarnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}

      <div className="admin-edit-grid">
        <section className="admin-panel">
          <h2>상품 내용</h2>
          <form
            action={updateProductAction}
            className="admin-form admin-edit-form"
            id="product-edit-form"
          >
            <input name="id" type="hidden" value={product.id} />

            <div className="admin-form-grid">
              <label>
                <span>상품명</span>
                <input name="titleKo" required defaultValue={product.titleKo} />
              </label>
              <label>
                <span>slug</span>
                <input
                  name="slug"
                  pattern="[a-z0-9-]+"
                  required
                  defaultValue={product.slug}
                />
              </label>
            </div>

            <label>
              <span>짧은 설명</span>
              <textarea
                name="shortDescription"
                required
                rows={3}
                defaultValue={product.shortDescription}
              />
            </label>

            <label>
              <span>작품 이야기</span>
              <textarea name="story" rows={6} defaultValue={product.story} />
            </label>

            <ProductImageManager
              formId="product-edit-form"
              initialImages={product.images}
              mediaAssets={mediaAssets}
              productId={product.id}
            />

            <div className="admin-form-grid">
              <label>
                <span>카테고리</span>
                <input name="category" required defaultValue={product.category} />
              </label>
              <label>
                <span>상품 유형</span>
                <select name="kind" defaultValue={product.kind}>
                  <option value="regular">상시 작품</option>
                  <option value="one_of_a_kind">하나뿐인 작품</option>
                </select>
              </label>
            </div>

            <div className="admin-form-grid">
              <label>
                <span>판매 상태</span>
                <select
                  name="availabilityStatus"
                  defaultValue={product.commerce.availabilityStatus}
                >
                  <option value="available">판매중</option>
                  <option value="sold_out">판매완료</option>
                  <option value="upcoming">입고 예정</option>
                  <option value="archive">아카이브</option>
                </select>
              </label>
              <label>
                <span>알림 CTA</span>
                <select
                  name="restockCtaType"
                  defaultValue={product.restockCtaType ?? ""}
                >
                  <option value="">없음</option>
                  <option value="restock_alert">재입고 알림</option>
                  <option value="similar_work_alert">비슷한 작품 알림</option>
                  <option value="next_limited_alert">다음 한정 소식</option>
                </select>
              </label>
            </div>

            <div className="admin-form-grid">
              <label>
                <span>가격</span>
                <input
                  min="0"
                  name="price"
                  type="number"
                  defaultValue={product.commerce.price ?? ""}
                />
              </label>
              <label>
                <span>재고</span>
                <input
                  min="0"
                  name="stockQuantity"
                  type="number"
                  defaultValue={product.commerce.stockQuantity ?? ""}
                />
              </label>
            </div>

            <div className="admin-check-row">
              <label>
                <input
                  defaultChecked={product.published}
                  name="published"
                  type="checkbox"
                />
                <span>공개</span>
              </label>
              <label>
                <input
                  defaultChecked={product.isLimited}
                  name="isLimited"
                  type="checkbox"
                />
                <span>한정</span>
              </label>
              <label>
                <input
                  defaultChecked={product.isArchived}
                  name="isArchived"
                  type="checkbox"
                />
                <span>아카이브</span>
              </label>
            </div>

            <label>
              <span>한정 유형</span>
              <select name="limitedType" defaultValue={product.limitedType ?? ""}>
                <option value="">없음</option>
                <option value="quantity">수량 한정</option>
                <option value="period">기간 한정</option>
                <option value="kiln_batch">가마 소성 한정</option>
                <option value="project">프로젝트 한정</option>
              </select>
            </label>

            <div className="admin-form-grid">
              <label>
                <span>소재</span>
                <input name="material" defaultValue={product.material} />
              </label>
              <label>
                <span>유약</span>
                <input name="glaze" defaultValue={product.glaze} />
              </label>
            </div>

            <label>
              <span>크기</span>
              <input name="size" defaultValue={product.size} />
            </label>

            <label>
              <span>사용 안내</span>
              <textarea
                name="usageNote"
                rows={3}
                defaultValue={product.usageNote}
              />
            </label>

            <label>
              <span>관리 안내</span>
              <textarea name="careNote" rows={3} defaultValue={product.careNote} />
            </label>

            <label>
              <span>배송 안내</span>
              <textarea
                name="shippingNote"
                rows={3}
                defaultValue={product.shippingNote}
              />
            </label>

            <button className="button-primary" type="submit">
              저장
            </button>
          </form>
        </section>

        <aside className="admin-panel admin-sync-panel">
          <h2>Cafe24 동기화</h2>

          <Cafe24ConnectionPanel connection={cafe24Connection} />

          <Cafe24ReadinessPanel readiness={readiness} />

          <section className="admin-sync-block">
            <h3>전송 미리보기</h3>
            <dl className="admin-sync-list">
              {preview.requestSummary.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <form action={syncProductToCafe24Action} className="admin-sync-form">
            <input name="id" type="hidden" value={product.id} />
            <button
              className="button-primary"
              disabled={!preview.canSync}
              type="submit"
            >
              Cafe24 동기화
            </button>
          </form>
          <section className="admin-sync-block">
            <h3>매핑 정보</h3>
            <form action={saveCafe24MappingAction} className="admin-form">
              <input name="id" type="hidden" value={product.id} />
              <label>
                <span>상품번호</span>
                <input name="productNo" defaultValue={product.cafe24.productNo ?? ""} />
              </label>
              <label>
                <span>품목코드</span>
                <input
                  name="variantCode"
                  defaultValue={product.cafe24.variantCode ?? ""}
                />
              </label>
              <div className="admin-form-grid">
                <label>
                  <span>카테고리 번호</span>
                  <input
                    min="1"
                    name="categoryNo"
                    type="number"
                    defaultValue={product.cafe24.categoryNo ?? ""}
                  />
                </label>
                <label>
                  <span>진열 그룹</span>
                  <input
                    min="1"
                    name="displayGroup"
                    type="number"
                    defaultValue={product.cafe24.displayGroup ?? ""}
                  />
                </label>
              </div>
              <label>
                <span>상품 URL</span>
                <input name="productUrl" defaultValue={product.cafe24.productUrl ?? ""} />
              </label>
              <label>
                <span>바로구매 주문서 URL</span>
                <input
                  name="checkoutUrl"
                  placeholder="https://mallid.cafe24.com/surl/O/50"
                  defaultValue={product.cafe24.checkoutUrl ?? ""}
                />
              </label>
              <button className="admin-secondary-button" type="submit">
                매핑 저장
              </button>
            </form>
          </section>

          <section className="admin-sync-block">
            <h3>최근 로그</h3>
            {syncLogs.length > 0 ? (
              <div className="admin-sync-log-list">
                {syncLogs.map((log) => (
                  <SyncLogItem key={log.id} log={log} />
                ))}
              </div>
            ) : (
              <p className="admin-empty-text">아직 동기화 로그가 없습니다.</p>
            )}
          </section>
          <section className="admin-sync-block admin-danger-zone">
            <h3>상품 삭제</h3>
            <p>
              삭제하면 Consepot 상품 원장과 연결된 이미지, Cafe24 매핑, 동기화
              로그가 함께 삭제됩니다. 실행하려면 아래 입력칸에{" "}
              <strong>{product.slug}</strong>를 그대로 입력해 주세요.
            </p>
            <form action={deleteProductAction} className="admin-form">
              <input name="id" type="hidden" value={product.id} />
              <label>
                <span>삭제 확인</span>
                <input
                  autoComplete="off"
                  name="confirmSlug"
                  placeholder={product.slug}
                  required
                />
              </label>
              <button className="admin-danger-button" type="submit">
                상품 삭제
              </button>
            </form>
          </section>
        </aside>
      </div>
    </main>
  );
}

function getAdminWarnings(product: ConsepotProduct, previewWarnings: string[]) {
  const warnings = [...previewWarnings];

  if (
    product.commerce.availabilityStatus === "available" &&
    !getProductPurchaseHref(product)
  ) {
    warnings.push("판매중 상품이지만 Cafe24 구매 이동 경로가 아직 없습니다.");
  }

  if (
    product.commerce.availabilityStatus === "available" &&
    !["cafe24_cart", "cafe24_checkout"].includes(
      getProductPurchaseKind(product) ?? "",
    )
  ) {
    warnings.push(
      "주문서 직행을 위해 Cafe24 바로구매 주문서 URL을 입력하거나 Cafe24 상품 동기화로 상품번호를 받아오세요.",
    );
  }

  if (product.published && product.commerce.price === null) {
    warnings.push("공개 상품이지만 가격이 비어 있습니다.");
  }

  return [...new Set(warnings)];
}

function getProductPublishErrorMessage(code: string) {
  return (
    {
      cover: "공개하려면 대표 이미지가 필요합니다.",
      list: "공개하려면 목록 이미지가 필요합니다.",
      price: "판매중 상품은 가격이 필요합니다.",
      slug: "공개하려면 slug가 필요합니다.",
      title: "공개하려면 상품명이 필요합니다.",
      variant:
        "공개하려면 선택된 이미지의 detail/list variant가 모두 생성되어 있어야 합니다. 미디어 화면에서 variant를 재생성해 주세요.",
    }[code] ??
    "공개에 필요한 필수 정보가 부족합니다. 상품명, slug, 대표 이미지, 목록 이미지, 이미지 variant를 확인해 주세요."
  );
}

function Cafe24ConnectionPanel({
  connection,
}: {
  connection: Cafe24ConnectionStatus;
}) {
  const state = getCafe24ConnectionUiState(connection);

  return (
    <section
      className={`admin-sync-block admin-connection-status admin-connection-status-${state.kind}`}
    >
      <div className="admin-connection-head">
        <span>Cafe24 연결</span>
        <strong>{state.title}</strong>
      </div>
      <p>{state.message}</p>
      <dl className="admin-connection-meta">
        <div>
          <dt>저장 위치</dt>
          <dd>{connectionSourceLabel(connection.source)}</dd>
        </div>
        <div>
          <dt>몰 ID</dt>
          <dd>{connection.mallId ?? "미설정"}</dd>
        </div>
        {connection.expiresAt ? (
          <div>
            <dt>Access token 만료</dt>
            <dd>{formatDateTime(connection.expiresAt)}</dd>
          </div>
        ) : null}
        {connection.refreshTokenExpiresAt ? (
          <div>
            <dt>Refresh token 만료</dt>
            <dd>{formatDateTime(connection.refreshTokenExpiresAt)}</dd>
          </div>
        ) : null}
        {connection.scopes.length > 0 ? (
          <div>
            <dt>권한</dt>
            <dd>{connection.scopes.join(", ")}</dd>
          </div>
        ) : null}
        {connection.missingEnv.length > 0 ? (
          <div>
            <dt>필요 env</dt>
            <dd>{connection.missingEnv.join(", ")}</dd>
          </div>
        ) : null}
      </dl>
      <a
        className={`admin-secondary-button admin-oauth-button ${
          connection.connected ? "admin-oauth-button-muted" : ""
        }`}
        href="/api/cafe24/oauth/start"
      >
        {connection.connected ? "Cafe24 재인증" : "Cafe24 연결하기"}
      </a>
    </section>
  );
}

function Cafe24ReadinessPanel({
  readiness,
}: {
  readiness: Cafe24ProductReadiness;
}) {
  return (
    <section className="admin-sync-block">
      <h3>구매 준비 체크</h3>
      <div
        className={`admin-publish-readiness ${
          readiness.ready
            ? "admin-publish-readiness-ok"
            : "admin-publish-readiness-warning"
        }`}
      >
        <strong>
          {readiness.ready
            ? "Cafe24 구매 준비가 완료되었습니다."
            : "구매 전 확인이 필요합니다."}
        </strong>
        <ul>
          {readiness.checks.map((check) => (
            <li
              className={`admin-readiness-check admin-readiness-check-${check.status}`}
              key={check.id}
            >
              <span>{check.label}</span>
              <em>{check.message}</em>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function getCafe24ConnectionUiState(connection: Cafe24ConnectionStatus) {
  if (!connection.connected) {
    return {
      kind: "missing",
      message: "상품 동기화를 시작하려면 최초 1회 Cafe24 인증이 필요합니다.",
      title: "미연결",
    };
  }

  if (connection.source === "env") {
    return {
      kind: "warning",
      message:
        "환경변수 access token을 사용 중입니다. 만료되면 재인증이 필요합니다.",
      title: "임시 연결",
    };
  }

  if (!connection.refreshable) {
    return {
      kind: "warning",
      message:
        "토큰은 저장되어 있지만 refresh token이 없어 만료 후 재인증이 필요합니다.",
      title: "연결됨",
    };
  }

  return {
    kind: "connected",
    message:
      "토큰이 Supabase에 저장되어 있습니다. 만료 시 서버에서 자동 갱신합니다.",
    title: "연결됨",
  };
}

function connectionSourceLabel(source: Cafe24ConnectionStatus["source"]) {
  return {
    env: "환경변수",
    none: "없음",
    supabase: "Supabase",
  }[source];
}

function SyncLogItem({ log }: { log: ProductSyncLog }) {
  return (
    <article className={`admin-sync-log admin-sync-log-${log.status}`}>
      <div>
        <strong>{syncLogStatusLabel(log)}</strong>
        <span>{formatDateTime(log.createdAt)}</span>
      </div>
      {log.message ? <p>{log.message}</p> : null}
    </article>
  );
}

function syncLogStatusLabel(log: ProductSyncLog) {
  const action = {
    manual_mapping: "수동 매핑",
    preview: "미리보기",
    sync: "동기화",
  }[log.action];

  const status = {
    failed: "실패",
    preview: "확인",
    success: "성공",
  }[log.status];

  return `${action} ${status}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
