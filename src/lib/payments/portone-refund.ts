import "server-only";

import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/lib/orders/order-model";
import { updateCheckoutAttemptPayment } from "@/lib/orders/checkout-attempt-store";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

type GiftAddressNotificationRefundInput = {
  actionUrl?: string | null;
  notificationJobId?: string | null;
  orderId: string;
  reason: string;
};

type GiftAddressNotificationRefundResult =
  | {
      status: "refunded";
    }
  | {
      status: "already_refunded" | "refund_pending" | "skipped";
      reason?: string;
    };

type GiftAddressRefundOrderRow = {
  id: string;
  order_number: string;
  order_status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  portone_payment_id: string | null;
  total_krw: number;
};

const giftAddressRefundOrderSelect =
  "id, order_number, order_status, payment_status, payment_method, portone_payment_id, total_krw";
const portOneRefundTimeoutMs = 7000;
const giftAddressRefundReason = "Gift address link delivery failed";

export async function refundGiftAddressNotificationFailure(
  input: GiftAddressNotificationRefundInput,
): Promise<GiftAddressNotificationRefundResult> {
  if (!isSupabaseConfigured()) {
    return { reason: "supabase_unconfigured", status: "skipped" };
  }

  const order = await readGiftAddressRefundOrder(input.orderId);

  if (!order) {
    return { reason: "order_not_found", status: "skipped" };
  }

  if (order.payment_status === "refunded") {
    return { status: "already_refunded" };
  }

  if (!["paid", "refund_pending"].includes(order.payment_status)) {
    return { reason: `payment_status_${order.payment_status}`, status: "skipped" };
  }

  if (!order.portone_payment_id) {
    await markGiftAddressRefundPending({
      errorMessage: "PortOne payment id is missing.",
      input,
      order,
    });
    return { reason: "missing_portone_payment_id", status: "refund_pending" };
  }

  if (order.payment_status === "paid") {
    await markGiftAddressRefundPending({ input, order });
  }

  let cancellation: unknown;

  try {
    cancellation = await cancelPortOnePayment({
      amount: order.total_krw,
      paymentId: order.portone_payment_id,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "PortOne refund failed.";
    await markGiftAddressRefundPending({
      errorMessage,
      input,
      order,
    });
    return { reason: "portone_refund_failed", status: "refund_pending" };
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.rpc(
    "mark_shop_order_refunded_after_notification_failure",
    {
      p_cancellation: toJsonPayload(cancellation),
      p_order_id: order.id,
      p_payment_id: order.portone_payment_id,
      p_reason: "gift_address_notification_failed",
    },
  );

  if (error) {
    await markGiftAddressRefundPending({
      errorMessage: `Refund state update failed: ${error.message}`,
      input,
      order,
    });
    return { reason: "refund_state_update_failed", status: "refund_pending" };
  }

  await updateCheckoutAttemptPayment({
    errorCode: "gift_address_notification_failed",
    errorMessage: "Gift address link could not be delivered; payment refunded.",
    orderId: order.id,
    paymentId: order.portone_payment_id,
    status: "payment_canceled",
  });

  return { status: "refunded" };
}

async function readGiftAddressRefundOrder(orderId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_orders")
    .select(giftAddressRefundOrderSelect)
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error(`Gift address refund order lookup failed: ${error.message}`);
  }

  return data as GiftAddressRefundOrderRow | null;
}

async function markGiftAddressRefundPending({
  errorMessage,
  input,
  order,
}: {
  errorMessage?: string;
  input: GiftAddressNotificationRefundInput;
  order: GiftAddressRefundOrderRow;
}) {
  const supabase = getSupabaseAdminClient();
  const { error: orderError } = await supabase
    .from("shop_orders")
    .update({
      order_status: "refund_pending",
      payment_status: "refund_pending",
    })
    .eq("id", order.id)
    .in("payment_status", ["paid", "refund_pending"]);

  if (orderError) {
    throw new Error(`Refund pending order update failed: ${orderError.message}`);
  }

  if (order.portone_payment_id) {
    const { error: paymentError } = await supabase
      .from("shop_payments")
      .update({
        status: "refund_pending",
      })
      .eq("provider", "portone")
      .eq("provider_payment_id", order.portone_payment_id);

    if (paymentError) {
      throw new Error(
        `Refund pending payment update failed: ${paymentError.message}`,
      );
    }
  }

  const { error: eventError } = await supabase.from("shop_order_events").insert({
    actor: "system",
    event_type: errorMessage
      ? "gift_address_request_auto_refund_failed"
      : "gift_address_request_auto_refund_started",
    order_id: order.id,
    payload: {
      actionUrl: input.actionUrl ?? null,
      errorMessage: errorMessage ?? null,
      notificationJobId: input.notificationJobId ?? null,
      paymentId: order.portone_payment_id,
      reason: input.reason,
    },
  });

  if (eventError) {
    console.error(`Gift address refund event insert failed: ${eventError.message}`);
  }

  await updateCheckoutAttemptPayment({
    errorCode: "gift_address_notification_failed",
    errorMessage: errorMessage ?? "Gift address link could not be delivered.",
    orderId: order.id,
    paymentId: order.portone_payment_id,
    status: "manual_review",
  });
}

async function cancelPortOnePayment({
  amount,
  paymentId,
}: {
  amount: number;
  paymentId: string;
}) {
  const response = await fetchPortOneRefundApi(
    `${getPortOneApiBaseUrl()}/payments/${encodeURIComponent(paymentId)}/cancel`,
    {
      body: JSON.stringify({
        amount,
        currentCancellableAmount: amount,
        reason: giftAddressRefundReason,
        requester: "ADMIN",
        skipWebhook: true,
        storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID?.trim() || undefined,
      }),
      headers: {
        Authorization: `PortOne ${getPortOneApiSecret()}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );
  const responseText = await response.text();
  const payload = parseJsonResponse(responseText);

  if (!response.ok && !isPortOneAlreadyCanceledError(payload, responseText)) {
    throw new Error(`PortOne refund failed: ${responseText}`);
  }

  return payload;
}

async function fetchPortOneRefundApi(input: RequestInfo | URL, init: RequestInit) {
  try {
    return await fetch(input, {
      ...init,
      signal: AbortSignal.timeout(portOneRefundTimeoutMs),
    });
  } catch (error) {
    throw new Error(
      error instanceof DOMException && error.name === "TimeoutError"
        ? "PortOne refund request timed out."
        : "PortOne refund request failed.",
    );
  }
}

function getPortOneApiBaseUrl() {
  return process.env.PORTONE_API_BASE_URL || "https://api.portone.io";
}

function getPortOneApiSecret() {
  const apiSecret = process.env.PORTONE_API_SECRET?.trim();

  if (!apiSecret) {
    throw new Error("PORTONE_API_SECRET is not configured.");
  }

  return apiSecret;
}

function parseJsonResponse(value: string) {
  if (!value) {
    return {};
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return { raw: value };
  }
}

function isPortOneAlreadyCanceledError(payload: unknown, responseText: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "type" in payload &&
    payload.type === "PaymentAlreadyCancelledError"
  ) {
    return true;
  }

  return /already.*cancel/i.test(responseText);
}

function toJsonPayload(value: unknown) {
  if (value === undefined) {
    return {};
  }

  return value;
}
