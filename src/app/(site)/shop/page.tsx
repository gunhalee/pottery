import { SiteLink } from "@/components/navigation/site-link";
import { PageIntro, PageShell } from "@/components/site/primitives";
import { ProductGrid } from "@/components/shop/product-grid";
import { siteConfig } from "@/lib/config/site";
import { getPublishedProductListItems } from "@/lib/shop";

export default async function ShopPage() {
  const products = await getPublishedProductListItems();

  return (
    <PageShell>
      <PageIntro
        subtitle={
          <span className="shop-intro-links">
            <SiteLink href="/order/lookup">주문 조회</SiteLink>
            <span aria-hidden="true" className="shop-intro-links-divider">
              |
            </span>
            <a
              href={siteConfig.kakaoChannelUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              상품 문의
            </a>
          </span>
        }
        title="소장하기"
      />

      <ProductGrid products={products} />
    </PageShell>
  );
}
