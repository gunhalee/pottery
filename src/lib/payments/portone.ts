import "server-only";

import { randomBytes } from "node:crypto";
import type { PaymentStatus } from "@/lib/orders/order-model";
import { enqueueOrderNotificationJobs } from "@/lib/notifications/order-notifications";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type {
  PortOnePaymentCompleteResult,
  PortOnePaymentPrepareResult,
  PortOnePayMethod,
} from "./portone-model";

type OrderPaymentRow = {
  id: string;
  order_number: string;
  order_status: string;
  orderer_email: string;
  orderer_name: string;
  orderer_phone: string;
  payment_status: PaymentStatus;
  portone_payment_id: string | null;
  total_krw: number;
};

type OrderPaymentItemRow = {
  product_title: string;
  quantity: number;
  snapshot: {
    checkoutMode?: string;
  } | null;
};

type PortOnePayment = {
  amount?: {
    total?: number;
  };
  id?: string;
  paymentId?: string;
  status?: string;
  transactionId?: string;
  transactions?: Array<{
    id?: string;
    txId?: string;
  }>;
  txId?: string;
};

export class PortOnePaymentError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "PortOnePaymentError";
  }
}

export async function preparePortOnePayment({
  orderId,
  origin,
}: {
  orderId: string;
  origin: string;
}): Promise<PortOnePaymentPrepareResult> {
  const checkoutConfig = getPortOneCheckoutConfig();
  const supabase = getSupabaseAdminClient();
  const order = await readPaymentOrder(orderId);

  if (order.order_status === "paid" || order.payment_status === "paid") {
    throw new PortOnePaymentError("이미 결제가 완료된 주문입니다.");
  }

  if (order.order_status === "canceled" || order.payment_status === "canceled") {
    throw new PortOnePaymentError("취소된 주문은 결제할 수 없습니다.");
  }

  const paymentId = order.portone_payment_id ?? generatePortOnePaymentId();

  if (!order.portone_payment_id) {
    const { error } = await supabase
      .from("shop_orders")
      .update({
        portone_payment_id: paymentId,
      })
      .eq("id", order.id);

    if (error) {
      throw new PortOnePaymentError(`결제 ID 저장 실패: ${error.message}`, 500);
    }
  }

  const { error: paymentError } = await supabase.from("shop_payments").upsert(
    {
      amount_krw: order.total_krw,
      order_id: order.id,
      provider: "portone",
      provider_payment_id: paymentId,
      status: "requested",
    },
    { onConflict: "provider,provider_payment_id" },
  );

  if (paymentError) {
    throw new PortOnePaymentError(
      `결제 요청 기록 저장 실패: ${paymentError.message}`,
      500,
    );
  }

  await supabase.from("shop_order_events").insert({
    actor: "system",
    event_type: "portone_payment_prepared",
    order_id: order.id,
    payload: {
      paymentId,
      total: order.total_krw,
    },
  });

  const paymentInfo = await buildOrderPaymentInfo(order.id);

  return {
    paymentRequest: {
      channelKey: checkoutConfig.channelKey,
      currency: "CURRENCY_KRW",
      customer: {
        email: order.orderer_email,
        fullName: order.orderer_name,
        phoneNumber: order.orderer_phone,
      },
      customData: {
        orderId: order.id,
        orderNumber: order.order_number,
      },
      orderName: paymentInfo.orderName,
      payMethod:
        paymentInfo.checkoutMode === "naver_pay"
          ? "EASY_PAY"
          : checkoutConfig.payMethod,
      paymentId,
      redirectUrl: `${origin}/checkout/complete?orderId=${encodeURIComponent(
        order.id,
      )}`,
      storeId: checkoutConfig.storeId,
      totalAmount: order.total_krw,
    },
  };
}

export async function completePortOnePayment({
  orderId,
  paymentId,
}: {
  orderId: string;
  paymentId: string;
}): Promise<PortOnePaymentCompleteResult> {
  const payment = await fetchPortOnePayment(paymentId);
  const order = await readPaymentOrder(orderId);

  if (order.portone_payment_id !== paymentId) {
    throw new PortOnePaymentError("주문과 결제 ID가 일치하지 않습니다.");
  }

  const paymentAmount = payment.amount?.total;

  if (paymentAmount !== order.total_krw) {
    await recordPaymentFailure({
      orderId: order.id,
      payment,
      paymentId,
      reason: "amount_mismatch",
    });
    throw new PortOnePaymentError("결제 금액이 주문 금액과 일치하지 않습니다.");
  }

  const normalizedStatus = normalizePortOnePaymentStatus(payment.status);

  if (normalizedStatus === "paid") {
    const transactionId = getPortOneTransactionId(payment);
    const result = await markOrderPaid({
      orderId: order.id,
      payment,
      paymentId,
      transactionId,
    });
    await enqueueOrderNotificationJobs({
      orderId: order.id,
      orderNumber: result.orderNumber,
      payload: {
        paymentId,
        total: order.total_krw,
      },
      recipient: {
        email: order.orderer_email,
        phone: order.orderer_phone,
      },
      template: "payment_paid",
    });

    return {
      orderNumber: result.orderNumber,
      paymentStatus: "paid",
      total: order.total_krw,
    };
  }

  await upsertPaymentRecord({
    orderId: order.id,
    payment,
    paymentId,
    status: normalizedStatus,
  });
  await enqueueOrderNotificationJobs({
    orderId: order.id,
    orderNumber: order.order_number,
    payload: {
      paymentId,
      status: normalizedStatus,
      total: order.total_krw,
    },
    recipient: {
      email: order.orderer_email,
      phone: order.orderer_phone,
    },
    template: "payment_attention",
  });

  return {
    orderNumber: order.order_number,
    paymentStatus: normalizedStatus,
    total: order.total_krw,
  };
}

async function readPaymentOrder(orderId: string): Promise<OrderPaymentRow> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_orders")
    .select(
      "id, order_number, order_status, payment_status, orderer_name, orderer_phone, orderer_email, total_krw, portone_payment_id",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) {
    throw new PortOnePaymentError("주문을 찾지 못했습니다.", 404);
  }

  return data as OrderPaymentRow;
}

async function buildOrderPaymentInfo(orderId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_order_items")
    .select("product_title, quantity, snapshot")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new PortOnePaymentError(`주문 상품 조회 실패: ${error.message}`, 500);
  }

  const items = (data ?? []) as OrderPaymentItemRow[];
  const firstItem = items[0];

  if (!firstItem) {
    throw new PortOnePaymentError("주문 상품이 없습니다.");
  }

  const extraCount = items.length - 1;
  const suffix = extraCount > 0 ? ` 외 ${extraCount}건` : "";

  return {
    checkoutMode: firstItem.snapshot?.checkoutMode ?? null,
    orderName: `${firstItem.product_title}${suffix}`,
  };
}

async function fetchPortOnePayment(paymentId: string): Promise<PortOnePayment> {
  const apiSecret = process.env.PORTONE_API_SECRET;

  if (!apiSecret) {
    throw new PortOnePaymentError(
      "PORTONE_API_SECRET 환경변수가 설정되지 않았습니다.",
      503,
    );
  }

  const response = await fetch(
    `${getPortOneApiBaseUrl()}/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: {
        Authorization: `PortOne ${apiSecret}`,
      },
    },
  );

  if (!response.ok) {
    throw new PortOnePaymentError(
      `PortOne 결제 조회 실패: ${await response.text()}`,
      502,
    );
  }

  return (await response.json()) as PortOnePayment;
}

async function markOrderPaid({
  orderId,
  payment,
  paymentId,
  transactionId,
}: {
  orderId: string;
  payment: PortOnePayment;
  paymentId: string;
  transactionId: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .rpc("mark_shop_order_paid", {
      p_order_id: orderId,
      p_payment_id: paymentId,
      p_raw_payload: payment,
      p_transaction_id: transactionId,
    })
    .single();

  if (error || !data) {
    throw new PortOnePaymentError(
      `결제 완료 저장 실패: ${error?.message ?? "응답 없음"}`,
      500,
    );
  }

  const row = data as { order_number: string };

  return {
    orderNumber: row.order_number,
  };
}

async function recordPaymentFailure({
  orderId,
  payment,
  paymentId,
  reason,
}: {
  orderId: string;
  payment: PortOnePayment;
  paymentId: string;
  reason: string;
}) {
  await upsertPaymentRecord({
    orderId,
    payment,
    paymentId,
    status: "failed",
  });

  const supabase = getSupabaseAdminClient();
  await supabase.from("shop_order_events").insert({
    actor: "system",
    event_type: "portone_payment_verification_failed",
    order_id: orderId,
    payload: {
      payment,
      paymentId,
      reason,
    },
  });
}

async function upsertPaymentRecord({
  orderId,
  payment,
  paymentId,
  status,
}: {
  orderId: string;
  payment: PortOnePayment;
  paymentId: string;
  status: PaymentStatus;
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("shop_payments").upsert(
    {
      amount_krw: payment.amount?.total ?? 0,
      order_id: orderId,
      provider: "portone",
      provider_payment_id: paymentId,
      provider_transaction_id: getPortOneTransactionId(payment),
      raw_payload: payment,
      status,
    },
    { onConflict: "provider,provider_payment_id" },
  );

  if (error) {
    throw new PortOnePaymentError(`결제 기록 저장 실패: ${error.message}`, 500);
  }
}

function getPortOneCheckoutConfig() {
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;

  if (!storeId || !channelKey) {
    throw new PortOnePaymentError(
      "PortOne Store ID와 Channel Key 환경변수가 설정되지 않았습니다.",
      503,
    );
  }

  return {
    channelKey,
    payMethod: getPortOnePayMethod(),
    storeId,
  };
}

function getPortOnePayMethod(): PortOnePayMethod {
  const method = process.env.NEXT_PUBLIC_PORTONE_PAY_METHOD;

  if (isPortOnePayMethod(method)) {
    return method;
  }

  return "CARD";
}

function isPortOnePayMethod(value: string | undefined): value is PortOnePayMethod {
  return (
    value === "CARD" ||
    value === "TRANSFER" ||
    value === "VIRTUAL_ACCOUNT" ||
    value === "MOBILE" ||
    value === "GIFT_CERTIFICATE" ||
    value === "EASY_PAY"
  );
}

function getPortOneApiBaseUrl() {
  return process.env.PORTONE_API_BASE_URL || "https://api.portone.io";
}

function generatePortOnePaymentId() {
  return `cp${Date.now()}${randomBytes(4).toString("hex")}`;
}

function normalizePortOnePaymentStatus(
  status: string | undefined,
): PaymentStatus {
  if (status === "PAID") {
    return "paid";
  }

  if (status === "FAILED") {
    return "failed";
  }

  if (status === "CANCELLED" || status === "CANCELED") {
    return "canceled";
  }

  if (status === "PARTIAL_CANCELLED" || status === "PARTIAL_CANCELED") {
    return "partial_refunded";
  }

  if (status === "VIRTUAL_ACCOUNT_ISSUED" || status === "READY") {
    return "pending";
  }

  return "pending";
}

function getPortOneTransactionId(payment: PortOnePayment) {
  return (
    payment.transactionId ??
    payment.txId ??
    payment.transactions?.[0]?.id ??
    payment.transactions?.[0]?.txId ??
    null
  );
}
