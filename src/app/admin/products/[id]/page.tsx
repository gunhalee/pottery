import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  deleteProductAction,
  updateProductAction,
} from "../../actions";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminSuccessNotice } from "@/components/admin/admin-success-notice";
import { ProductImageManager } from "@/components/admin/product-image-manager";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { getProductById, type ConsepotProduct } from "@/lib/shop";
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
    publish_error?: string;
    saved?: string;
  }>;
};

export const metadata = {
  title: "Edit Product",
};

export default async function AdminProductEditPage({
  params,
  searchParams,
}: AdminProductEditPageProps) {
  const { id } = await params;
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect(`/admin/login?next=${encodeURIComponent(`/admin/products/${id}`)}`);
  }

  const [flags, product, mediaAssets] = await Promise.all([
    searchParams,
    getProductById(id),
    readMediaLibraryAssets(120),
  ]);

  if (!product) {
    notFound();
  }

  const publicHref = product.published ? `/shop/${product.slug}` : null;
  const adminWarnings = getAdminWarnings(product);

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Consepot Admin</p>
          <h1>{product.titleKo}</h1>
          <p>
            자체 상품 원장의 가격, 재고, 판매 상태를 수정합니다. 이 정보는
            상품 상세와 주문 생성의 기준으로 사용됩니다.
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
              ? "상품을 저장했고 공개 페이지에 반영했습니다."
              : "상품을 저장했습니다. 아직 공개 전이라 공개 상품 링크는 표시되지 않습니다."
          }
          key={`product-saved-${product.updatedAt}`}
          primaryHref={publicHref}
          primaryLabel="공개 상품 보기"
          title="저장했습니다."
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
              <span>작업물 이야기</span>
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
                  <option value="regular">상시 작업물</option>
                  <option value="one_of_a_kind">하나뿐인 작업물</option>
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
                  <option value="similar_work_alert">비슷한 작업물 문의</option>
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

            <section className="admin-form-section">
              <h3>식물 옵션</h3>
              <div className="admin-check-row">
                <label>
                  <input
                    defaultChecked={product.plantOption.enabled}
                    name="plantOptionEnabled"
                    type="checkbox"
                  />
                  <span>식물 포함 옵션 사용</span>
                </label>
              </div>
              <div className="admin-form-grid">
                <label>
                  <span>식물 포함 추가금</span>
                  <input
                    min="0"
                    name="plantOptionPriceDelta"
                    type="number"
                    defaultValue={product.plantOption.priceDelta}
                  />
                </label>
                <label>
                  <span>식물 구성</span>
                  <input
                    name="plantSpecies"
                    defaultValue={product.plantOption.species ?? ""}
                    placeholder="예: 소형 관엽, 계절 생화"
                  />
                </label>
              </div>
              <label>
                <span>식물 관리 안내</span>
                <textarea
                  name="plantCareNotice"
                  rows={3}
                  defaultValue={product.plantOption.careNotice ?? ""}
                />
              </label>
              <label>
                <span>식물 반품 제한 안내</span>
                <textarea
                  name="plantReturnNotice"
                  rows={3}
                  defaultValue={product.plantOption.returnNotice ?? ""}
                />
              </label>
              <label>
                <span>식물 배송 제한 안내</span>
                <textarea
                  name="plantShippingRestrictionNotice"
                  rows={3}
                  defaultValue={
                    product.plantOption.shippingRestrictionNotice ?? ""
                  }
                />
              </label>
            </section>

            <section className="admin-form-section">
              <h3>추가 제작 주문</h3>
              <div className="admin-check-row">
                <label>
                  <input
                    defaultChecked={product.madeToOrder.available}
                    name="madeToOrderAvailable"
                    type="checkbox"
                  />
                  <span>재고 소진 후 추가 제작 주문 허용</span>
                </label>
              </div>
              <div className="admin-form-grid">
                <label>
                  <span>최소 소요일</span>
                  <input
                    min="1"
                    name="madeToOrderDaysMin"
                    type="number"
                    defaultValue={product.madeToOrder.daysMin}
                  />
                </label>
                <label>
                  <span>최대 소요일</span>
                  <input
                    min="1"
                    name="madeToOrderDaysMax"
                    type="number"
                    defaultValue={product.madeToOrder.daysMax}
                  />
                </label>
              </div>
              <label>
                <span>추가 제작 안내</span>
                <textarea
                  name="madeToOrderNotice"
                  rows={3}
                  defaultValue={product.madeToOrder.notice ?? ""}
                  placeholder="결제 또는 입금 확인일 기준 약 30~45일 소요됩니다."
                />
              </label>
            </section>

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
                <input name="material" defaultValue={product.material ?? ""} />
              </label>
              <label>
                <span>유약</span>
                <input name="glaze" defaultValue={product.glaze ?? ""} />
              </label>
            </div>

            <label>
              <span>크기</span>
              <input name="size" defaultValue={product.size ?? ""} />
            </label>

            <label>
              <span>사용 안내</span>
              <textarea
                name="usageNote"
                rows={3}
                defaultValue={product.usageNote ?? ""}
              />
            </label>

            <label>
              <span>관리 안내</span>
              <textarea
                name="careNote"
                rows={3}
                defaultValue={product.careNote ?? ""}
              />
            </label>

            <label>
              <span>배송 안내</span>
              <textarea
                name="shippingNote"
                rows={3}
                defaultValue={product.shippingNote ?? ""}
              />
            </label>

            <button className="button-primary" type="submit">
              저장
            </button>
          </form>
        </section>

        <aside className="admin-panel admin-sync-panel">
          <section className="admin-sync-block">
            <h2>판매 기준</h2>
            <dl className="admin-sync-list">
              <div>
                <dt>판매 상태</dt>
                <dd>{availabilityLabel(product.commerce.availabilityStatus)}</dd>
              </div>
              <div>
                <dt>가격</dt>
                <dd>
                  {product.commerce.price === null
                    ? "미입력"
                    : `${product.commerce.price.toLocaleString("ko-KR")}원`}
                </dd>
              </div>
              <div>
                <dt>재고</dt>
                <dd>{product.commerce.stockQuantity ?? "미입력"}</dd>
              </div>
              <div>
                <dt>식물 옵션</dt>
                <dd>
                  {product.plantOption.enabled
                    ? `사용 · +${product.plantOption.priceDelta.toLocaleString("ko-KR")}원`
                    : "미사용"}
                </dd>
              </div>
              <div>
                <dt>추가 제작</dt>
                <dd>
                  {product.madeToOrder.available
                    ? `${product.madeToOrder.daysMin}~${product.madeToOrder.daysMax}일`
                    : "미사용"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="admin-sync-block admin-danger-zone">
            <h3>상품 삭제</h3>
            <p>
              삭제하면 Consepot 상품 원장과 연결된 이미지 참조가 함께
              정리됩니다. 실행하려면 아래 입력칸에{" "}
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

function getAdminWarnings(product: ConsepotProduct) {
  const warnings: string[] = [];

  if (product.published && product.images.length === 0) {
    warnings.push("공개 상품에는 이미지가 필요합니다.");
  }

  if (
    product.commerce.availabilityStatus === "available" &&
    product.commerce.price === null
  ) {
    warnings.push("판매중 상품에는 가격이 필요합니다.");
  }

  if (
    product.commerce.availabilityStatus === "available" &&
    product.commerce.stockQuantity === 0
  ) {
    warnings.push("판매중 상품의 재고가 0개입니다.");
  }

  return warnings;
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
        "공개하려면 선택한 이미지의 detail/list variant가 준비되어야 합니다. 미디어 화면에서 variant를 재생성해 주세요.",
    }[code] ??
    "공개에 필요한 필수 정보가 부족합니다. 상품명, slug, 대표 이미지, 목록 이미지, 이미지 variant를 확인해 주세요."
  );
}

function availabilityLabel(
  status: ConsepotProduct["commerce"]["availabilityStatus"],
) {
  return {
    archive: "아카이브",
    available: "판매중",
    sold_out: "판매완료",
    upcoming: "입고 예정",
  }[status];
}
