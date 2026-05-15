import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ShopBackButton } from "@/components/navigation/shop-back-button";
import { ProductGrid } from "@/components/shop/product-grid";
import { WishlistRefreshOnChange } from "@/components/shop/wishlist-refresh-on-change";
import { SiteEmptyState } from "@/components/site/actions";
import { PageIntro, PageShell } from "@/components/site/primitives";
import { noIndexRobots } from "@/lib/seo/site";
import { getAnonymousSessionFromCookieStore } from "@/lib/shop/anonymous-session";
import { getWishlistProductIdsForSession } from "@/lib/shop/wishlist-store";
import { getPublishedProductListItems } from "@/lib/shop";

export const metadata: Metadata = {
  description: "찜한 도자 상품을 한곳에서 확인합니다.",
  robots: noIndexRobots,
  title: "찜 목록",
};

export default async function ShopWishlistPage() {
  const cookieStore = await cookies();
  const session = await getAnonymousSessionFromCookieStore(cookieStore);
  const [wishlistProductIds, products] = await Promise.all([
    session ? getWishlistProductIdsForSession(session.id) : Promise.resolve([]),
    getPublishedProductListItems(),
  ]);
  const wishlistOrder = new Map(
    wishlistProductIds.map((productId, index) => [productId, index]),
  );
  const wishedProducts = products
    .filter((product) => wishlistOrder.has(product.id))
    .sort(
      (a, b) =>
        (wishlistOrder.get(a.id) ?? 0) - (wishlistOrder.get(b.id) ?? 0),
    );

  return (
    <PageShell className="shop-subpage-shell">
      <nav className="product-detail-backbar" aria-label="찜 목록 탐색">
        <ShopBackButton fallbackHref="/shop" />
      </nav>

      <PageIntro title="찜 목록" variant="compact" />

      <WishlistRefreshOnChange />
      {wishedProducts.length > 0 ? (
        <ProductGrid
          products={wishedProducts}
          wishedProductIds={wishlistProductIds}
        />
      ) : (
        <SiteEmptyState
          className="shop-subpage-empty"
          title="아직 찜한 상품이 없습니다."
        >
          <p>마음에 드는 작업물을 발견하면 하트 버튼으로 저장해 보세요.</p>
        </SiteEmptyState>
      )}
    </PageShell>
  );
}
