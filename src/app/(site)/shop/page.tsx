import {
  BottomNav,
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
          subtitle="소장 가능한 작품을 모았습니다."
          title="작품 소장"
        />

        <a className="shop-order-lookup-link link-arrow" href="/order/lookup">
          주문 조회
        </a>
        <CartReturnNotice />
        <RecentProductsPanel products={recentProductSummaries} />
        <ProductGrid products={products} />
      </PageShell>
      <BottomNav
        links={[
          { href: "/gallery", label: "작업 과정 보기" },
          { href: "/news", label: "공방 소식" },
        ]}
      />
    </>
  );
}
