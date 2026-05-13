import Link from "next/link";
import { redirect } from "next/navigation";
import { createProductDraftAction } from "../actions";
import {
  AdminActionButton,
  AdminActionLink,
} from "@/components/admin/admin-actions";
import { AdminNav } from "@/components/admin/admin-nav";
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
            Consepot 자체 상품 원장을 관리합니다. 저장한 가격, 재고, 판매 상태는
            사이트 구매 흐름의 기준이 됩니다.
          </p>
        </div>
        <AdminNav />
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
          <AdminActionButton type="submit" variant="primary">
            초안 만들기
          </AdminActionButton>
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
      <AdminActionLink href={`/admin/products/${product.id}`}>
        편집
      </AdminActionLink>
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
