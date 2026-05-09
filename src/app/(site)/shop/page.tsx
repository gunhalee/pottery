import {
  PageIntro,
  PageShell,
} from "@/components/site/primitives";
import { ProductGrid } from "@/components/shop/product-grid";
import {
  CartReturnNotice,
  RecentProductsPanel,
} from "@/components/shop/recent-products";
import { getPublishedProductListItems } from "@/lib/shop";
import { toProductListSummary } from "@/lib/shop/product-list-view";

export default async function ShopPage() {
  const products = await getPublishedProductListItems();
  const recentProductSummaries = products.map(toProductListSummary);

  return (
    <>
      <PageShell>
        <PageIntro
          subtitle="주문 가능한 작업물들입니다."
          title="소장하기"
        />

        <a className="shop-order-lookup-link link-arrow" href="/order/lookup">
          주문 조회
        </a>
        <CartReturnNotice />
        <RecentProductsPanel products={recentProductSummaries} />
        <ProductGrid products={products} />
      </PageShell>
    </>
  );
}
