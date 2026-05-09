import {
  ExternalCtaCardLink,
  PageIntro,
  PageShell,
  Section,
} from "@/components/site/primitives";
import { ProductGrid } from "@/components/shop/product-grid";
import {
  CartReturnNotice,
  RecentProductsPanel,
} from "@/components/shop/recent-products";
import { siteConfig } from "@/lib/config/site";
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
      <Section className="intro-gallery-cta shop-inquiry-cta" id="shop-inquiries">
        <ExternalCtaCardLink
          href={siteConfig.kakaoChannelUrl}
          label="카카오채널 문의하기"
        >
          <p className="body-copy">상품 문의를 하고 싶다면</p>
        </ExternalCtaCardLink>
      </Section>
    </>
  );
}
