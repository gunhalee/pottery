import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  logoutAdminAction,
  syncProductToCafe24Action,
  updateProductAction,
} from "../../actions";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { getProductById } from "@/lib/shop";

type AdminProductEditPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    created?: string;
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
          <form action={logoutAdminAction}>
            <button className="admin-text-button" type="submit">
              로그아웃
            </button>
          </form>
        </div>
      </header>

      {flags.created ? <div className="admin-alert">초안을 만들었습니다.</div> : null}
      {flags.saved ? <div className="admin-alert">저장했습니다.</div> : null}
      {flags.synced ? (
        <div className="admin-alert">Cafe24 상품 동기화를 완료했습니다.</div>
      ) : null}
      {flags.sync_error ? (
        <div className="admin-alert admin-alert-danger">
          Cafe24 동기화 실패: {flags.sync_error}
        </div>
      ) : null}

      <div className="admin-edit-grid">
        <section className="admin-panel">
          <h2>상품 내용</h2>
          <form action={updateProductAction} className="admin-form admin-edit-form">
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
          <dl className="admin-sync-list">
            <div>
              <dt>상품번호</dt>
              <dd>{product.cafe24.productNo ?? "미연결"}</dd>
            </div>
            <div>
              <dt>품목코드</dt>
              <dd>{product.cafe24.variantCode ?? "미확인"}</dd>
            </div>
            <div>
              <dt>상태</dt>
              <dd>{product.cafe24.mappingStatus}</dd>
            </div>
            <div>
              <dt>마지막 동기화</dt>
              <dd>{product.cafe24.lastSyncedAt ?? "없음"}</dd>
            </div>
          </dl>
          {product.cafe24.productUrl ? (
            <a
              className="admin-text-button"
              href={product.cafe24.productUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              Cafe24 상품 보기
            </a>
          ) : null}
          <p>
            동기화는 상품명, 가격, 판매 상태, 최소 설명, 재고를 Cafe24로
            보냅니다. 이미지는 Cafe24 경로가 있는 최소 이미지만 후속 단계에서
            붙입니다.
          </p>
          <form action={syncProductToCafe24Action}>
            <input name="id" type="hidden" value={product.id} />
            <button className="button-primary" type="submit">
              Cafe24 동기화
            </button>
          </form>
          {product.cafe24.lastSyncError ? (
            <div className="admin-alert admin-alert-danger">
              {product.cafe24.lastSyncError}
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
