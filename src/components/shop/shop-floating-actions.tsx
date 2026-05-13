import { FloatingActionLink } from "@/components/navigation/floating-action-primitives";
import { ShopFloatingCartBadgeLoader } from "./shop-floating-cart-badge-loader";
import { ShopCartIcon, ShopHeartIcon } from "./shop-icons";

export function ShopFloatingActions() {
  return (
    <div className="shop-floating-actions" aria-label="상점 빠른 이동">
      <FloatingActionLink
        aria-label="찜 목록 보기"
        href="/shop/wishlist"
        prefetch={false}
      >
        <ShopHeartIcon />
      </FloatingActionLink>
      <FloatingActionLink
        aria-label="장바구니 보기"
        className="floating-cart-button"
        href="/shop/cart"
        prefetch={false}
      >
        <ShopCartIcon />
        <ShopFloatingCartBadgeLoader />
      </FloatingActionLink>
    </div>
  );
}
