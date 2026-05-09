"use client";

import { useEffect, useState } from "react";

type StoredCartReturn = {
  cartHref: string;
  productName: string;
  savedAt: number;
};

const cartReturnKey = "consepot_recent_cart";
const cartReturnMaxAge = 1000 * 60 * 60 * 24 * 7;

export function CartReturnNotice() {
  const [cartReturn, setCartReturn] = useState<StoredCartReturn | null>(null);

  useEffect(() => {
    try {
      const item = readCartReturn();

      if (!item || Date.now() - item.savedAt > cartReturnMaxAge) {
        window.localStorage.removeItem(cartReturnKey);
        return;
      }

      window.setTimeout(() => setCartReturn(item), 0);
    } catch {
      window.setTimeout(() => setCartReturn(null), 0);
    }
  }, []);

  if (!cartReturn) {
    return null;
  }

  return (
    <aside className="cart-return-notice" aria-label="Cafe24 장바구니 복귀">
      <div>
        <span>최근 장바구니</span>
        <strong>{cartReturn.productName}</strong>
      </div>
      <a href={cartReturn.cartHref}>장바구니로 돌아가기</a>
      <button
        aria-label="장바구니 복귀 알림 닫기"
        onClick={() => {
          window.localStorage.removeItem(cartReturnKey);
          setCartReturn(null);
        }}
        type="button"
      >
        닫기
      </button>
    </aside>
  );
}

function readCartReturn() {
  const value = window.localStorage.getItem(cartReturnKey);

  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return isStoredCartReturn(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isStoredCartReturn(value: unknown): value is StoredCartReturn {
  return (
    typeof value === "object" &&
    value !== null &&
    "cartHref" in value &&
    "productName" in value &&
    "savedAt" in value &&
    typeof value.cartHref === "string" &&
    typeof value.productName === "string" &&
    typeof value.savedAt === "number"
  );
}
