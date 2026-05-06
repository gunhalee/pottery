import {
  BottomNav,
  PageIntro,
  PageShell,
} from "@/components/site/primitives";
import { ProductGrid } from "@/components/shop/product-grid";
import {
  CartReturnNotice,
  RecentProductsPanel,
  type RecentProductSummary,
} from "@/components/shop/recent-products";
import {
  formatProductPrice,
  getProductListImage,
  getPublishedProducts,
  type ConsepotProduct,
} from "@/lib/shop";

export default async function ShopPage() {
  const products = await getPublishedProducts();
  const recentProductSummaries = products.map(toRecentProductSummary);

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

function toRecentProductSummary(
  product: ConsepotProduct,
): RecentProductSummary {
  const image = getProductListImage(product);

  return {
    href: `/shop/${product.slug}`,
    imageAlt: image?.alt ?? product.titleKo,
    imageSrc: image?.src ?? null,
    price: formatProductPrice(product),
    slug: product.slug,
    title: product.titleKo,
  };
}
