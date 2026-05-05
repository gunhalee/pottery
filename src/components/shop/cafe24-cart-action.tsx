"use client";

import { useState } from "react";

export type Cafe24CartActionProps = {
  apiBaseUrl: string;
  apiVersion: string;
  basketType: "A0000" | "A0001";
  checkoutHref: string;
  className?: string;
  clientId: string;
  duplicatedItemCheck: "F" | "T";
  frontApiKey: string;
  label: string;
  maxQuantity: number;
  prepaidShippingFee: "C" | "P";
  productNo: string;
  shopNo: number;
  variantCode: string;
};

type ActionStatus = "error" | "idle" | "loading";

export function Cafe24CartAction({
  apiBaseUrl,
  apiVersion,
  basketType,
  checkoutHref,
  className = "button-primary",
  clientId,
  duplicatedItemCheck,
  frontApiKey,
  label,
  maxQuantity,
  prepaidShippingFee,
  productNo,
  shopNo,
  variantCode,
}: Cafe24CartActionProps) {
  const normalizedMaxQuantity = Math.max(1, maxQuantity);
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const clampedQuantity = clampQuantity(quantity, normalizedMaxQuantity);

  async function addToCart() {
    if (status === "loading") {
      return;
    }

    setStatus("loading");
    setMessage(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Cafe24-Api-Version": apiVersion,
        "X-Cafe24-Client-Id": clientId,
      };

      if (frontApiKey) {
        headers.Authorization = `Basic ${window.btoa(`${clientId}:${frontApiKey}`)}`;
      }

      const response = await fetch(`${apiBaseUrl}/carts`, {
        body: JSON.stringify({
          request: {
            basket_type: basketType,
            duplicated_item_check: duplicatedItemCheck,
            prepaid_shipping_fee: prepaidShippingFee,
            product_no: Number(productNo),
            shop_no: shopNo,
            variants: [
              {
                quantity: clampedQuantity,
                variants_code: variantCode,
              },
            ],
          },
        }),
        credentials: "include",
        headers,
        method: "POST",
      });
      const payload = await readPayload(response);

      if (!response.ok) {
        throw new Error(extractCafe24ErrorMessage(payload, response.status));
      }

      window.location.assign(checkoutHref);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Cafe24 장바구니 담기에 실패했습니다.",
      );
    }
  }

  return (
    <div className="product-cart-action">
      <label className="product-quantity-control">
        <span>수량</span>
        <div>
          <button
            aria-label="수량 줄이기"
            disabled={clampedQuantity <= 1 || status === "loading"}
            onClick={() =>
              setQuantity((current) =>
                clampQuantity(current - 1, normalizedMaxQuantity),
              )
            }
            type="button"
          >
            -
          </button>
          <input
            aria-label="구매 수량"
            inputMode="numeric"
            max={normalizedMaxQuantity}
            min={1}
            onChange={(event) =>
              setQuantity(
                clampQuantity(Number(event.target.value), normalizedMaxQuantity),
              )
            }
            type="number"
            value={clampedQuantity}
          />
          <button
            aria-label="수량 늘리기"
            disabled={
              clampedQuantity >= normalizedMaxQuantity || status === "loading"
            }
            onClick={() =>
              setQuantity((current) =>
                clampQuantity(current + 1, normalizedMaxQuantity),
              )
            }
            type="button"
          >
            +
          </button>
        </div>
        <small>최대 {normalizedMaxQuantity}개</small>
      </label>
      <button
        className={className}
        disabled={status === "loading"}
        onClick={addToCart}
        type="button"
      >
        {status === "loading" ? "장바구니 담는 중" : label}
      </button>
      {message ? <p className="product-cart-error">{message}</p> : null}
    </div>
  );
}

async function readPayload(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function clampQuantity(value: number, maxQuantity: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(Math.max(1, Math.floor(value)), maxQuantity);
}

function extractCafe24ErrorMessage(payload: unknown, status: number) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error
  ) {
    return String(payload.error.message);
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload
  ) {
    return String(payload.message);
  }

  if (typeof payload === "string") {
    return payload;
  }

  return `Cafe24 장바구니 API 요청 실패 (${status})`;
}
