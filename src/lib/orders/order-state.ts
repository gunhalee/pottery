import type {
  FulfillmentStatus,
  OrderStatus,
  PaymentStatus,
  ShippingMethod,
} from "./order-model";

const terminalOrderStatuses = new Set<OrderStatus>([
  "canceled",
  "deposit_expired",
  "refunded",
]);

const pickupFulfillmentStatuses = new Set<FulfillmentStatus>([
  "pickup_ready",
  "picked_up",
]);

const parcelFulfillmentStatuses = new Set<FulfillmentStatus>([
  "delivered",
  "shipped",
]);

export function deriveOrderStatusFromPaymentAndFulfillment({
  fulfillmentStatus,
  orderStatus,
  paymentStatus,
}: {
  fulfillmentStatus: FulfillmentStatus;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
}): OrderStatus {
  if (terminalOrderStatuses.has(orderStatus) || orderStatus === "refund_pending") {
    return orderStatus;
  }

  if (fulfillmentStatus === "canceled") {
    return "canceled";
  }

  if (paymentStatus !== "paid") {
    return orderStatus === "draft" ? "draft" : "pending_payment";
  }

  if (fulfillmentStatus === "shipped") {
    return "shipped";
  }

  if (fulfillmentStatus === "delivered" || fulfillmentStatus === "picked_up") {
    return "delivered";
  }

  if (fulfillmentStatus === "preparing" || fulfillmentStatus === "pickup_ready") {
    return "preparing";
  }

  return "paid";
}

export function assertFulfillmentTransitionAllowed({
  allowBackwardFulfillment,
  currentFulfillmentStatus,
  nextFulfillmentStatus,
  orderStatus,
  paymentStatus,
  shippingMethod,
}: {
  allowBackwardFulfillment: boolean;
  currentFulfillmentStatus: FulfillmentStatus;
  nextFulfillmentStatus: FulfillmentStatus;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  shippingMethod: ShippingMethod;
}) {
  if (nextFulfillmentStatus === currentFulfillmentStatus) {
    return;
  }

  if (terminalOrderStatuses.has(orderStatus)) {
    throw new Error("종결된 주문의 배송/수령 상태는 변경할 수 없습니다.");
  }

  if (paymentStatus !== "paid") {
    throw new Error("결제 완료 전에는 배송/수령 상태를 변경할 수 없습니다.");
  }

  assertFulfillmentMatchesShippingMethod({
    nextFulfillmentStatus,
    shippingMethod,
  });

  if (
    isBackwardFulfillmentChange({
      currentFulfillmentStatus,
      nextFulfillmentStatus,
      shippingMethod,
    }) &&
    !allowBackwardFulfillment
  ) {
    throw new Error("이전 단계로 되돌리려면 확인 체크가 필요합니다.");
  }
}

export function assertPaymentTransitionAllowed({
  currentPaymentStatus,
  nextPaymentStatus,
  orderStatus,
}: {
  currentPaymentStatus: PaymentStatus;
  nextPaymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
}) {
  if (
    currentPaymentStatus === "paid" &&
    !["paid", "partial_refunded", "refund_pending", "refunded"].includes(
      nextPaymentStatus,
    )
  ) {
    throw new Error("이미 결제 완료된 주문은 미결제 상태로 되돌릴 수 없습니다.");
  }

  if (orderStatus === "deposit_expired" && nextPaymentStatus === "paid") {
    throw new Error("입금 기한이 만료된 주문은 결제 완료로 전환할 수 없습니다.");
  }

  if (orderStatus === "canceled" && nextPaymentStatus === "paid") {
    throw new Error("취소된 주문은 결제 완료로 전환할 수 없습니다.");
  }

  if (orderStatus === "refunded" && nextPaymentStatus !== "refunded") {
    throw new Error("환불 완료 주문은 다른 결제 상태로 전환할 수 없습니다.");
  }
}

function assertFulfillmentMatchesShippingMethod({
  nextFulfillmentStatus,
  shippingMethod,
}: {
  nextFulfillmentStatus: FulfillmentStatus;
  shippingMethod: ShippingMethod;
}) {
  if (
    shippingMethod === "pickup" &&
    parcelFulfillmentStatuses.has(nextFulfillmentStatus)
  ) {
    throw new Error("방문 수령 주문에는 택배 배송 상태를 사용할 수 없습니다.");
  }

  if (
    shippingMethod === "parcel" &&
    pickupFulfillmentStatuses.has(nextFulfillmentStatus)
  ) {
    throw new Error("택배 주문에는 방문 수령 상태를 사용할 수 없습니다.");
  }
}

function isBackwardFulfillmentChange({
  currentFulfillmentStatus,
  nextFulfillmentStatus,
  shippingMethod,
}: {
  currentFulfillmentStatus: FulfillmentStatus;
  nextFulfillmentStatus: FulfillmentStatus;
  shippingMethod: ShippingMethod;
}) {
  const weights =
    shippingMethod === "pickup"
      ? {
          canceled: 4,
          delivered: 3,
          picked_up: 3,
          pickup_ready: 2,
          preparing: 1,
          returned: 4,
          shipped: 2,
          unfulfilled: 0,
        }
      : {
          canceled: 4,
          delivered: 3,
          picked_up: 3,
          pickup_ready: 1,
          preparing: 1,
          returned: 4,
          shipped: 2,
          unfulfilled: 0,
        };

  return weights[nextFulfillmentStatus] < weights[currentFulfillmentStatus];
}
