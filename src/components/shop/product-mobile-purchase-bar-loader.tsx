"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { scheduleWhenIdle } from "@/lib/browser/schedule-when-idle";
import type { ProductMobilePurchaseBarProps } from "./product-mobile-purchase-bar";

const mobilePurchaseQuery = "(max-width: 900px)";

const ProductMobilePurchaseBar = dynamic(
  () =>
    import("./product-mobile-purchase-bar").then(
      (mod) => mod.ProductMobilePurchaseBar,
    ),
  { ssr: false },
);

type ProductMobilePurchaseBarLoaderProps = Omit<
  ProductMobilePurchaseBarProps,
  "isVisible"
> & {
  payRowId: string;
};

export function ProductMobilePurchaseBarLoader({
  payRowId,
  ...props
}: ProductMobilePurchaseBarLoaderProps) {
  const [enabled, setEnabled] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(mobilePurchaseQuery);

    function syncViewport() {
      const isMobile = mediaQuery.matches;
      setIsMobileViewport(isMobile);

      if (!isMobile) {
        setEnabled(false);
        setIsVisible(false);
      }
    }

    syncViewport();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncViewport);

      return () => {
        mediaQuery.removeEventListener("change", syncViewport);
      };
    }

    mediaQuery.addListener(syncViewport);

    return () => {
      mediaQuery.removeListener(syncViewport);
    };
  }, []);

  useEffect(() => {
    if (!isMobileViewport || enabled) {
      return;
    }

    const cancel = scheduleWhenIdle(() => setEnabled(true), 900);

    return cancel;
  }, [enabled, isMobileViewport]);

  useEffect(() => {
    if (!enabled || !isMobileViewport) {
      return;
    }

    const payRow = document.getElementById(payRowId);

    if (!payRow || typeof IntersectionObserver === "undefined") {
      const handle = window.setTimeout(() => setIsVisible(true), 0);

      return () => window.clearTimeout(handle);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(!entry.isIntersecting);
      },
      { threshold: 0.01 },
    );

    observer.observe(payRow);

    return () => {
      observer.disconnect();
    };
  }, [enabled, isMobileViewport, payRowId]);

  if (!enabled || !isMobileViewport) {
    return null;
  }

  return <ProductMobilePurchaseBar {...props} isVisible={isVisible} />;
}
