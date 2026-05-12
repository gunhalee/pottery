"use client";

import { useEffect, useRef, useState } from "react";
import { dispatchWishlistChanged } from "@/lib/shop/wishlist-events";

type ProductWishlistButtonProps = {
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
  const interactedRef = useRef(false);

  useEffect(() => {
    if (typeof initialWished === "boolean") {
      return;
    }

    const controller = new AbortController();

    async function readWishlistState() {
      try {
        const response = await fetch(
          `/api/wishlist?productSlug=${encodeURIComponent(productSlug)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          return;
        }

        const result = (await response.json()) as { wished?: boolean };

        if (!interactedRef.current) {
          setIsWished(Boolean(result.wished));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    readWishlistState();

    return () => {
      controller.abort();
    };
  }, [initialWished, productSlug]);

  async function toggleWishlist() {
    const nextWished = !isWished;

    interactedRef.current = true;
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
      setIsWished(!nextWished);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <button
      aria-label={`${productTitle} ${isWished ? "찜 해제" : "찜하기"}`}
      aria-pressed={isWished}
      className={className}
      disabled={isSaving}
      onClick={toggleWishlist}
      type="button"
    >
      <HeartIcon filled={isWished} />
    </button>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      viewBox="0 0 24 24"
    >
      <path d="M20.4 5.6a5.2 5.2 0 0 0-7.4 0L12 6.7l-1-1.1a5.2 5.2 0 0 0-7.4 7.4l1 1 7.4 7.2 7.4-7.2 1-1a5.2 5.2 0 0 0 0-7.4Z" />
    </svg>
  );
}
