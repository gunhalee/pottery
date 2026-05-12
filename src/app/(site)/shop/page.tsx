import { SiteLink } from "@/components/navigation/site-link";
import { PageShell } from "@/components/site/primitives";
import { ProductGrid } from "@/components/shop/product-grid";
import { siteConfig } from "@/lib/config/site";
import { getPublishedProductListItems } from "@/lib/shop";

export default async function ShopPage() {
  const products = await getPublishedProductListItems();

  return (
    <PageShell className="listing-page-shell">
      <h1 className="sr-only">소장하기</h1>
      <nav className="shop-utility-nav" aria-label="상점 바로가기">
        <SiteLink href="/shop/wishlist">찜 목록</SiteLink>
        <span aria-hidden="true" className="shop-utility-divider">
          |
        </span>
        <SiteLink href="/shop/cart">장바구니</SiteLink>
        <span aria-hidden="true" className="shop-utility-divider">
          |
        </span>
        <SiteLink href="/order/lookup">주문 조회</SiteLink>
        <span aria-hidden="true" className="shop-utility-divider">
          |
        </span>
        <a
          href={siteConfig.kakaoChannelUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          상품 문의
        </a>
      </nav>

      <ProductGrid products={products} />
    </PageShell>
  );
}
