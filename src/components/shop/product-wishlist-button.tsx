"use client";

import { useEffect, useRef, useState } from "react";
import {
  dispatchWishlistChanged,
  wishlistChangedEventName,
  type WishlistChangedDetail,
} from "@/lib/shop/wishlist-events";
import { ShopHeartIcon } from "./shop-icons";

export type ProductWishlistButtonProps = {
  className?: string;
  initialWished?: boolean;
  productSlug: string;
  productTitle: string;
};

export function ProductWishlistButton({
  className,
  initialWished,
  productSlug,
  productTitle,
}: ProductWishlistButtonProps) {
  const [isWished, setIsWished] = useState(Boolean(initialWished));
  const [isSaving, setIsSaving] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const hasResolvedStateRef = useRef(typeof initialWished === "boolean");
  const interactedRef = useRef(false);

  useEffect(() => {
    if (typeof initialWished !== "boolean") {
      return;
    }

    hasResolvedStateRef.current = true;

    if (!interactedRef.current) {
      setIsWished(initialWished);
    }
  }, [initialWished]);

  useEffect(() => {
    function syncWishlistState(event: Event) {
      const detail = (event as CustomEvent<WishlistChangedDetail>).detail;

      if (detail?.productSlug !== productSlug) {
        return;
      }

      interactedRef.current = true;
      hasResolvedStateRef.current = true;
      setIsWished(detail.wished);
    }

    window.addEventListener(wishlistChangedEventName, syncWishlistState);

    return () => {
      window.removeEventListener(wishlistChangedEventName, syncWishlistState);
    };
  }, [productSlug]);

  async function toggleWishlist() {
    const currentWished = hasResolvedStateRef.current
      ? isWished
      : await readWishlistState();
    const nextWished = !currentWished;

    interactedRef.current = true;
    hasResolvedStateRef.current = true;
    setIsWished(nextWished);
    setIsSaving(true);

    try {
      const response = await fetch("/api/wishlist", {
        body: JSON.stringify({
          productSlug,
          wished: nextWished,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        wished?: boolean;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "찜 저장 중 오류가 발생했습니다.");
      }

      const wished = Boolean(result.wished);
      setIsWished(wished);
      dispatchWishlistChanged({ productSlug, wished });
    } catch {
      setIsWished(currentWished);
    } finally {
      setIsSaving(false);
    }
  }

  async function readWishlistState() {
    setIsChecking(true);

    try {
      const response = await fetch(
        `/api/wishlist?productSlug=${encodeURIComponent(productSlug)}`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        return false;
      }

      const result = (await response.json()) as { wished?: boolean };
      const wished = Boolean(result.wished);
      setIsWished(wished);

      return wished;
    } catch {
      return false;
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <button
      aria-label={`${productTitle} ${isWished ? "찜 해제" : "찜하기"}`}
      aria-pressed={isWished}
      className={className}
      disabled={isChecking || isSaving}
      onClick={toggleWishlist}
      type="button"
    >
      <ShopHeartIcon filled={isWished} />
    </button>
  );
}
