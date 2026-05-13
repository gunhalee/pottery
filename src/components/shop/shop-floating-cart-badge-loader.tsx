"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { scheduleWhenIdle } from "@/lib/browser/schedule-when-idle";

const ShopFloatingCartBadge = dynamic(
  () =>
    import("./shop-floating-cart-badge").then(
      (mod) => mod.ShopFloatingCartBadge,
    ),
  { ssr: false },
);

export function ShopFloatingCartBadgeLoader() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const cancel = scheduleWhenIdle(() => setEnabled(true), 2200);

    return cancel;
  }, []);

  return enabled ? <ShopFloatingCartBadge /> : null;
}
