import { CtaCardList } from "@/components/site/cta-card-list";
import { PageIntro, PageShell } from "@/components/site/primitives";
import { CartReturnNotice } from "@/components/shop/cart-return-notice";
import { ProductGrid } from "@/components/shop/product-grid";
import { shopTopCtas } from "@/lib/content/page-ctas";
import { getPublishedProductListItems } from "@/lib/shop";

export default async function ShopPage() {
  const products = await getPublishedProductListItems();

  return (
    <PageShell>
      <PageIntro
        subtitle="주문 가능한 작업물들입니다."
        title="소장하기"
      />

      <CartReturnNotice />
      <CtaCardList
        className="shop-top-cta-list"
        ctas={shopTopCtas}
        id="shop-inquiries"
      />
      <ProductGrid products={products} />
    </PageShell>
  );
}
