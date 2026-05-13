"use client";

import { useEffect, useState } from "react";
import {
  cartChangedEventName,
  getCartItemCount,
  readCartSnapshot,
} from "@/lib/shop/cart-storage";

export function ShopFloatingCartBadge() {
  const [cartItemCount, setCartItemCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function syncCartCount() {
      const snapshot = await readCartSnapshot().catch(() => null);

      if (active && snapshot) {
        setCartItemCount(getCartItemCount(snapshot));
      }
    }

    function syncCartCountFromEvent(event: Event) {
      const detail = (event as CustomEvent<{
        snapshot?: Parameters<typeof getCartItemCount>[0];
      }>).detail;

      if (detail?.snapshot) {
        setCartItemCount(getCartItemCount(detail.snapshot));
      }
    }

    void syncCartCount();
    window.addEventListener(cartChangedEventName, syncCartCountFromEvent);

    return () => {
      active = false;
      window.removeEventListener(cartChangedEventName, syncCartCountFromEvent);
    };
  }, []);

  return cartItemCount > 0 ? (
    <span className="floating-action-count">{cartItemCount}</span>
  ) : null;
}
