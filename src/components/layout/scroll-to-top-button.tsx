"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  cartChangedEventName,
  cartStorageKey,
  getCartItemCount,
  readCartSnapshot,
} from "@/lib/shop/cart-storage";

export function ScrollToTopButton() {
  const pathname = usePathname();
  const [cartItemCount, setCartItemCount] = useState(0);
  const showShopActions = pathname === "/shop" || pathname.startsWith("/shop/");

  useEffect(() => {
    function syncCartCount() {
      setCartItemCount(getCartItemCount(readCartSnapshot()));
    }

    function syncCartCountFromStorage(event: StorageEvent) {
      if (event.key === cartStorageKey) {
        syncCartCount();
      }
    }

    syncCartCount();
    window.addEventListener(cartChangedEventName, syncCartCount);
    window.addEventListener("storage", syncCartCountFromStorage);

    return () => {
      window.removeEventListener(cartChangedEventName, syncCartCount);
      window.removeEventListener("storage", syncCartCountFromStorage);
    };
  }, []);

  return (
    <div className="floating-quick-actions" aria-label="빠른 이동">
      {showShopActions ? (
        <>
          <Link
            aria-label="찜 보기"
            className="floating-action-button"
            href="/shop/wishlist"
            prefetch={false}
          >
            <HeartIcon />
          </Link>
          <Link
            aria-label="장바구니 보기"
            className="floating-action-button floating-cart-button"
            href="/shop/cart"
            prefetch={false}
          >
            <CartIcon />
            {cartItemCount > 0 ? (
              <span className="floating-action-count">{cartItemCount}</span>
            ) : null}
          </Link>
        </>
      ) : null}
      <a
        className="floating-action-button scroll-top-button"
        aria-label="맨 위로 이동"
        href="#site-top"
      >
        <span aria-hidden="true">↑</span>
      </a>
    </div>
  );
}

function HeartIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M20.4 5.6a5.2 5.2 0 0 0-7.4 0L12 6.7l-1-1.1a5.2 5.2 0 0 0-7.4 7.4l1 1 7.4 7.2 7.4-7.2 1-1a5.2 5.2 0 0 0 0-7.4Z" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M5.2 6.4h15l-1.4 7.2H7L5.8 3.8H3.5" />
      <circle cx="8.2" cy="19" r="1.4" />
      <circle cx="17.4" cy="19" r="1.4" />
    </svg>
  );
}
