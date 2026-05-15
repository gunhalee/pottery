import type { Metadata } from "next";
import { SiteLink } from "@/components/navigation/site-link";
import { PageShell } from "@/components/site/primitives";
import { ProductGrid } from "@/components/shop/product-grid";
import { siteConfig } from "@/lib/config/site";
import { getPublishedProductListItems } from "@/lib/shop";

export const metadata: Metadata = {
  alternates: {
    canonical: "/shop",
  },
  description:
    "초록을 담는 도자 화분, 그릇, 오브제와 선물하기 좋은 수공예 도자를 소개합니다.",
  openGraph: {
    description: "도자 화분, 그릇, 오브제와 수공예 도자 선물.",
    title: `소장하기 | ${siteConfig.name}`,
  },
  title: "경기도 광주 수공예 도자 화분과 오브제",
};

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
