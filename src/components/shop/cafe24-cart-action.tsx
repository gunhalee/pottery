"use client";

import { useState } from "react";

export type Cafe24CartActionProps = {
  basketType: "A0000" | "A0001";
  cartEndpoint: string;
  checkoutHref: string;
  className?: string;
  displayGroup: number;
  maxQuantity: number;
  prepaidShippingFee: "C" | "P";
  productName: string;
  productNo: string;
  productPrice: number;
  productCategoryNo: number;
  variantCode: string;
};

type ActionStatus = "error" | "idle" | "loading";

export function Cafe24CartAction({
  basketType,
  cartEndpoint,
  checkoutHref,
  className = "button-primary",
  displayGroup,
  maxQuantity,
  prepaidShippingFee,
  productCategoryNo,
  productName,
  productNo,
  productPrice,
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
      await fetch(cartEndpoint, {
        body: buildCafe24CartBody({
          basketType,
          displayGroup,
          prepaidShippingFee,
          productCategoryNo,
          productName,
          productNo,
          productPrice,
          quantity: clampedQuantity,
          variantCode,
        }),
        credentials: "include",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        method: "POST",
        mode: "no-cors",
      });

      window.location.assign(checkoutHref);
    } catch {
      setStatus("error");
      setMessage(
        "Cafe24 장바구니로 이동하지 못했습니다. 잠시 후 다시 시도해 주세요.",
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
        {status === "loading" ? "장바구니로 이동 중" : "구매하기"}
      </button>
      {message ? <p className="product-cart-error">{message}</p> : null}
    </div>
  );
}

function buildCafe24CartBody({
  basketType,
  displayGroup,
  prepaidShippingFee,
  productCategoryNo,
  productName,
  productNo,
  productPrice,
  quantity,
  variantCode,
}: {
  basketType: "A0000" | "A0001";
  displayGroup: number;
  prepaidShippingFee: "C" | "P";
  productCategoryNo: number;
  productName: string;
  productNo: string;
  productPrice: number;
  quantity: number;
  variantCode: string;
}) {
  const body = new URLSearchParams({
    basket_type: basketType,
    ch_ref: "",
    command: "add",
    delvType: "A",
    display_group: String(displayGroup),
    has_option: "F",
    is_cultural_tax: "F",
    is_direct_buy: "F",
    is_individual: "F",
    main_cate_no: String(productCategoryNo),
    multi_option_data: "",
    multi_option_schema: "",
    option_type: "T",
    prd_detail_ship_type: prepaidShippingFee,
    product_max: "-1",
    product_max_type: "F",
    product_min: "1",
    product_name: productName,
    product_no: productNo,
    product_price: String(productPrice),
    quantity: String(quantity),
    redirect: "2",
    relation_product: "yes",
  });

  body.append("selected_item[]", `${quantity}||${variantCode}`);

  return body;
}

function clampQuantity(value: number, maxQuantity: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(Math.max(1, Math.floor(value)), maxQuantity);
}
