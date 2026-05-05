import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAdminAction, createProductDraftAction } from "../actions";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { formatProductPrice, readProducts, type ConsepotProduct } from "@/lib/shop";

type AdminProductsPageProps = {
  searchParams: Promise<{
    deleted?: string;
    missing?: string;
  }>;
};

export const metadata = {
  title: "Product Admin",
};

export default async function AdminProductsPage({
  searchParams,
}: AdminProductsPageProps) {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect("/admin/login?next=/admin/products");
  }

  const params = await searchParams;
  const products = await readProducts();

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Consepot Admin</p>
          <h1>상품 관리</h1>
          <p>
            Consepot에서 상품 내용을 입력하고, 필요할 때 Cafe24로 수동
            동기화합니다.
          </p>
        </div>
        <form action={logoutAdminAction}>
          <button className="admin-text-button" type="submit">
            로그아웃
          </button>
        </form>
      </header>

      {params.missing ? (
        <div className="admin-alert admin-alert-danger">
          상품을 찾을 수 없습니다.
        </div>
      ) : null}
      {params.deleted ? (
        <div className="admin-alert">상품을 삭제했습니다.</div>
      ) : null}

      <section className="admin-panel">
        <h2>새 상품 초안</h2>
        <form action={createProductDraftAction} className="admin-inline-form">
          <label>
            <span>상품명</span>
            <input name="titleKo" placeholder="예: 작은 백자 접시" required />
          </label>
          <label>
            <span>slug</span>
            <input
              name="slug"
              pattern="[a-z0-9-]+"
              placeholder="small-white-plate"
              required
            />
          </label>
          <button className="button-primary" type="submit">
            초안 만들기
          </button>
        </form>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>상품 목록</h2>
          <span>{products.length} items</span>
        </div>
        <div className="admin-product-table">
          {products.map((product) => (
            <ProductRow key={product.id} product={product} />
          ))}
        </div>
      </section>
    </main>
  );
}

function ProductRow({ product }: { product: ConsepotProduct }) {
  return (
    <article className="admin-product-row">
      <div>
        <Link href={`/admin/products/${product.id}`} prefetch={false}>
          <strong>{product.titleKo}</strong>
        </Link>
        <span>/{product.slug}</span>
      </div>
      <div>{statusLabel(product.commerce.availabilityStatus)}</div>
      <div>{formatProductPrice(product)}</div>
      <div>{product.commerce.stockQuantity ?? "재고 미입력"}</div>
      <div>{mappingLabel(product.cafe24.mappingStatus)}</div>
      <Link
        className="admin-text-button"
        href={`/admin/products/${product.id}`}
        prefetch={false}
      >
        편집
      </Link>
    </article>
  );
}

function statusLabel(status: ConsepotProduct["commerce"]["availabilityStatus"]) {
  const labels = {
    archive: "아카이브",
    available: "판매중",
    sold_out: "판매완료",
    upcoming: "입고 예정",
  };

  return labels[status];
}

function mappingLabel(status: ConsepotProduct["cafe24"]["mappingStatus"]) {
  const labels = {
    mapped: "Cafe24 연결됨",
    not_applicable: "연결 제외",
    pending: "동기화 대기",
    sync_failed: "동기화 실패",
  };

  return labels[status];
}
