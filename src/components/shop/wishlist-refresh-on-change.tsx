"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  wishlistChangedEventName,
  type WishlistChangedDetail,
} from "@/lib/shop/wishlist-events";

export function WishlistRefreshOnChange() {
  const router = useRouter();

  useEffect(() => {
    function refreshWhenRemoved(event: Event) {
      const detail = (event as CustomEvent<WishlistChangedDetail>).detail;

      if (detail?.wished === false) {
        router.refresh();
      }
    }

    window.addEventListener(wishlistChangedEventName, refreshWhenRemoved);

    return () => {
      window.removeEventListener(wishlistChangedEventName, refreshWhenRemoved);
    };
  }, [router]);

  return null;
}
