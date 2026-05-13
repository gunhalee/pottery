import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ShopBackButton } from "@/components/navigation/shop-back-button";
import { CartPageClient } from "@/components/shop/cart-page-client";
import { PageIntro, PageShell } from "@/components/site/primitives";
import { getAnonymousSessionFromCookieStore } from "@/lib/shop/anonymous-session";
import { getCartSnapshotForSession } from "@/lib/shop/cart-store";
import { getPublishedProductListItems } from "@/lib/shop";

export const metadata: Metadata = {
  description: "장바구니에 담은 도자 상품을 확인합니다.",
  title: "장바구니",
};

export default async function ShopCartPage() {
  const cookieStore = await cookies();
  const session = await getAnonymousSessionFromCookieStore(cookieStore);
  const [products, initialSnapshot] = await Promise.all([
    getPublishedProductListItems(),
    getCartSnapshotForSession(session?.id ?? null),
  ]);

  return (
    <PageShell className="shop-subpage-shell">
      <nav className="product-detail-backbar" aria-label="장바구니 탐색">
        <ShopBackButton fallbackHref="/shop" />
      </nav>

      <PageIntro title="장바구니" variant="compact" />

      <CartPageClient initialSnapshot={initialSnapshot} products={products} />
    </PageShell>
  );
}
