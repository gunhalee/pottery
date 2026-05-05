"use client";

import { useEffect, useMemo, useState } from "react";

type Cafe24CartBridgeProps = {
  apiBaseUrl: string;
  apiVersion: string;
  basketType: "A0000" | "A0001";
  checkoutHref: string;
  clientId: string;
  duplicatedItemCheck: "F" | "T";
  fallbackHref: string | null;
  prepaidShippingFee: "C" | "P";
  productNo: string;
  productTitle: string;
  quantity: number;
  shopNo: number;
  variantCode: string;
};

type BridgeStatus = "error" | "loading" | "success";

const startedFlagPrefix = "__consepotCafe24CartBridgeStarted:";

export function Cafe24CartBridge({
  apiBaseUrl,
  apiVersion,
  basketType,
  checkoutHref,
  clientId,
  duplicatedItemCheck,
  fallbackHref,
  prepaidShippingFee,
  productNo,
  productTitle,
  quantity,
  shopNo,
  variantCode,
}: Cafe24CartBridgeProps) {
  const [status, setStatus] = useState<BridgeStatus>("loading");
  const [message, setMessage] = useState("Cafe24 장바구니에 작품을 담고 있습니다.");
  const startedFlag = useMemo(
    () => `${startedFlagPrefix}${productNo}:${variantCode}`,
    [productNo, variantCode],
  );

  useEffect(() => {
    const globalState = window as unknown as Record<string, boolean>;

    if (globalState[startedFlag]) {
      return;
    }

    globalState[startedFlag] = true;

    async function addToCart() {
      try {
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
                  quantity,
                  variants_code: variantCode,
                },
              ],
            },
          }),
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-Cafe24-Api-Version": apiVersion,
            "X-Cafe24-Client-Id": clientId,
          },
          method: "POST",
        });
        const payload = await readPayload(response);

        if (!response.ok) {
          throw new Error(extractCafe24ErrorMessage(payload, response.status));
        }

        setStatus("success");
        setMessage("장바구니에 담았습니다. Cafe24 주문 화면으로 이동합니다.");
        window.location.assign(checkoutHref);
      } catch (error) {
        globalState[startedFlag] = false;
        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Cafe24 장바구니 담기에 실패했습니다.",
        );
      }
    }

    void addToCart();
  }, [
    apiBaseUrl,
    apiVersion,
    basketType,
    checkoutHref,
    clientId,
    duplicatedItemCheck,
    prepaidShippingFee,
    productNo,
    quantity,
    shopNo,
    startedFlag,
    variantCode,
  ]);

  return (
    <section className="checkout-bridge-panel">
      <p className="small-caps">Cafe24 Checkout</p>
      <h1>{productTitle}</h1>
      <p>{message}</p>
      <div className={`checkout-bridge-status checkout-bridge-status-${status}`}>
        {status === "loading"
          ? "장바구니 처리 중"
          : status === "success"
            ? "이동 중"
            : "확인 필요"}
      </div>
      {status === "error" ? (
        <div className="checkout-bridge-actions">
          <button
            className="button-primary"
            onClick={() => window.location.reload()}
            type="button"
          >
            다시 시도
          </button>
          {fallbackHref ? (
            <a className="link-arrow" href={fallbackHref}>
              Cafe24 상품 페이지로 이동
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
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
