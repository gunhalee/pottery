import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ShopBackButton } from "@/components/navigation/shop-back-button";
import { ProductGrid } from "@/components/shop/product-grid";
import { WishlistRefreshOnChange } from "@/components/shop/wishlist-refresh-on-change";
import { PageIntro, PageShell } from "@/components/site/primitives";
import {
  readWishlistIdFromCookieValue,
  wishlistCookieName,
} from "@/lib/shop/wishlist-session";
import { getWishlistProductIds } from "@/lib/shop/wishlist-store";
import { getPublishedProductListItems } from "@/lib/shop";

export const metadata: Metadata = {
  description: "찜한 도자 상품을 한곳에서 확인합니다.",
  title: "찜 목록",
};

export default async function ShopWishlistPage() {
  const cookieStore = await cookies();
  const wishlistId = readWishlistIdFromCookieValue(
    cookieStore.get(wishlistCookieName)?.value,
  );
  const [wishlistProductIds, products] = await Promise.all([
    wishlistId ? getWishlistProductIds(wishlistId) : Promise.resolve([]),
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

      <PageIntro
        subtitle="찜해 둔 작업물을 모아 보고, 다시 상세 화면으로 이어갈 수 있습니다."
        title="찜 목록"
      />

      <WishlistRefreshOnChange />
      {wishedProducts.length > 0 ? (
        <ProductGrid
          products={wishedProducts}
          wishedProductIds={wishlistProductIds}
        />
      ) : (
        <div className="shop-subpage-empty">
          <strong>아직 찜한 상품이 없습니다.</strong>
          <p>마음에 드는 작업물을 발견하면 하트 버튼으로 저장해 보세요.</p>
        </div>
      )}
    </PageShell>
  );
}
