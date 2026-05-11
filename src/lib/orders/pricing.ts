import type { ShippingMethod } from "./order-model";

export const ORDER_SHIPPING_FEE_KRW = 3000;
export const ORDER_FREE_SHIPPING_THRESHOLD_KRW = 50000;

export type OrderAmountInput = {
  quantity: number;
  shippingMethod: ShippingMethod;
  unitPrice: number | null;
};

export type OrderAmountResult = {
  shippingFeeKrw: number;
  subtotalKrw: number | null;
  totalKrw: number | null;
};

export function calculateOrderAmounts({
  quantity,
  shippingMethod,
  unitPrice,
}: OrderAmountInput): OrderAmountResult {
  if (unitPrice === null) {
    return {
      shippingFeeKrw: 0,
      subtotalKrw: null,
      totalKrw: null,
    };
  }

  const safeQuantity = Math.max(1, Math.floor(quantity));
  const subtotalKrw = unitPrice * safeQuantity;
  const shippingFeeKrw =
    shippingMethod === "parcel" &&
    subtotalKrw < ORDER_FREE_SHIPPING_THRESHOLD_KRW
      ? ORDER_SHIPPING_FEE_KRW
      : 0;

  return {
    shippingFeeKrw,
    subtotalKrw,
    totalKrw: subtotalKrw + shippingFeeKrw,
  };
}
