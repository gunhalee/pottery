import "server-only";

import { randomBytes } from "node:crypto";
import { commerceConfig } from "@/lib/config/commerce";
import type {
  CashReceiptType,
  DepositAccount,
  PaymentMethod,
  PaymentStatus,
} from "@/lib/orders/order-model";
import {
  updateCheckoutAttemptPayment,
  type CheckoutAttemptStatus,
} from "@/lib/orders/checkout-attempt-store";
import { assertPaymentTransitionAllowed } from "@/lib/orders/order-state";
import { ensureGiftRecipientAddressRequest } from "@/lib/orders/gift-recipient";
import { getDepositDueAt } from "@/lib/orders/virtual-account";
import {
  enqueueAdminNotificationJob,
  enqueueOrderNotificationJobs,
} from "@/lib/notifications/order-notifications";
import { decryptSensitiveText } from "@/lib/security/sensitive-data";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type {
  PortOneCashReceiptType,
  PortOnePaymentCompleteResult,
  PortOnePaymentPrepareResult,
  PortOnePaymentRequest,
  PortOnePayMethod,
} from "./portone-model";
import {
  parseOrderPaymentItems,
  parseOrderPaymentRow,
  paymentOrderSelect,
  type OrderPaymentRow,
} from "./portone-order-rows";

type PortOnePaymentMethodPayload = {
  [key: string]: unknown;
  account?: unknown;
  accountHolder?: unknown;
  accountHolderName?: unknown;
  accountNumber?: unknown;
  bank?: unknown;
  bankCode?: unknown;
  bankName?: unknown;
  dueAt?: unknown;
  dueDate?: unknown;
  expiredAt?: unknown;
  expiryDate?: unknown;
  holderName?: unknown;
  issuedAt?: unknown;
  type?: unknown;
  remitteeName?: unknown;
  remitterName?: unknown;
  virtualAccount?: unknown;
  virtualAccountNumber?: unknown;
};

type PortOnePayment = {
  amount?: {
    total?: number;
  };
  cashReceipt?: {
    approvalNumber?: string;
    issueNumber?: string;
    pgReceiptId?: string;
    receiptUrl?: string;
    status?: string;
    type?: string;
  } | null;
  id?: string;
  method?: PortOnePaymentMethodPayload | null;
  paidAt?: string;
  paymentId?: string;
  paymentMethod?: PortOnePaymentMethodPayload | null;
  pgTxId?: string;
  status?: string;
  statusChangedAt?: string;
  transactionId?: string;
  transactions?: Array<{
    id?: string;
    txId?: string;
  }>;
  txId?: string;
  updatedAt?: string;
  virtualAccount?: PortOnePaymentMethodPayload | null;
};

type SyncPortOnePaymentInput = {
  orderId?: string;
  paymentId: string;
  source?: "admin" | "browser" | "cron" | "webhook";
  webhook?: unknown;
};

const portOneApiTimeoutMs = 7000;

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
  forceNewPaymentId = false,
  orderId,
  origin,
}: {
  forceNewPaymentId?: boolean;
  orderId: string;
  origin: string;
}): Promise<PortOnePaymentPrepareResult> {
  const supabase = getSupabaseAdminClient();
  const order = await readPaymentOrder(orderId);

  if (order.order_status === "paid" || order.payment_status === "paid") {
    throw new PortOnePaymentError("이미 결제가 완료된 주문입니다.");
  }

  if (order.order_status === "canceled") {
    throw new PortOnePaymentError("취소된 주문은 결제할 수 없습니다.");
  }

  const paymentInfo = await buildOrderPaymentInfo(order.id);
  const payMethod = resolvePortOnePayMethod(order.payment_method, paymentInfo.checkoutMode);
  const checkoutConfig = getPortOneCheckoutConfig(order.payment_method, payMethod);
  const normalizedPaymentMethod = normalizePortOneOrderPaymentMethod(
    order.payment_method,
    payMethod,
  );
  const replacePaymentId = shouldReplacePortOnePaymentId(order, forceNewPaymentId);
  const paymentId =
    replacePaymentId || !order.portone_payment_id
      ? generatePortOnePaymentId()
      : order.portone_payment_id;

  if (replacePaymentId || !order.portone_payment_id) {
    const resetPayload: Record<string, unknown> = {
      canceled_at: null,
      fulfillment_status: "unfulfilled",
      order_status: "pending_payment",
      payment_method: normalizedPaymentMethod,
      payment_status: "pending",
      portone_payment_id: paymentId,
    };

    if (normalizedPaymentMethod === "portone_virtual_account") {
      resetPayload.deposit_due_at = getDepositDueAt().toISOString();
      resetPayload.deposit_review_status = "waiting";
      resetPayload.virtual_account_account_holder = null;
      resetPayload.virtual_account_account_number = null;
      resetPayload.virtual_account_bank_name = null;
      resetPayload.virtual_account_issued_at = null;
    }

    const { error } = await supabase
      .from("shop_orders")
      .update(resetPayload)
      .eq("id", order.id);

    if (error) {
      throw new PortOnePaymentError(`결제 ID 저장 실패: ${error.message}`, 500);
    }
  }

  const { error: paymentError } = await supabase.from("shop_payments").upsert(
    {
      amount_krw: order.total_krw,
      order_id: order.id,
      payment_method: normalizedPaymentMethod,
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

  await preRegisterPortOnePayment({
    paymentId,
    storeId: checkoutConfig.storeId,
    totalAmount: order.total_krw,
  });

  await supabase.from("shop_order_events").insert({
    actor: "system",
    event_type: "portone_payment_prepared",
    order_id: order.id,
    payload: {
      paymentId,
      payMethod,
      paymentMethod: normalizedPaymentMethod,
      total: order.total_krw,
    },
  });

  const cashReceipt = readCashReceiptRequest(order);
  const paymentRequest: PortOnePaymentRequest = {
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
    noticeUrls: [`${origin}/api/payments/portone/webhook`],
    orderName: paymentInfo.orderName,
    payMethod,
    paymentId,
    redirectUrl: `${origin}/checkout/complete?orderId=${encodeURIComponent(
      order.id,
    )}`,
    storeId: checkoutConfig.storeId,
    totalAmount: order.total_krw,
  };

  if (payMethod === "VIRTUAL_ACCOUNT") {
    paymentRequest.virtualAccount = {
      accountExpiry: {
        validHours: commerceConfig.payment.virtualAccountDepositDueHours,
      },
      ...cashReceipt,
    };
  }

  if (payMethod === "TRANSFER") {
    paymentRequest.transfer = {
      ...cashReceipt,
    };
  }

  await updateCheckoutAttemptPayment({
    orderId: order.id,
    paymentId,
    status: "payment_prepared",
  });

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    paymentRequest,
    paymentStatus: "pending",
  };
}

export async function completePortOnePayment({
  orderId,
  paymentId,
}: {
  orderId?: string;
  paymentId: string;
}): Promise<PortOnePaymentCompleteResult> {
  return syncPortOnePayment({ orderId, paymentId, source: "browser" });
}

function shouldReplacePortOnePaymentId(
  order: OrderPaymentRow,
  forceNewPaymentId: boolean,
) {
  if (!forceNewPaymentId || !order.portone_payment_id) {
    return false;
  }

  return ["failed", "canceled", "expired"].includes(order.payment_status);
}

function mapPaymentStatusToCheckoutAttemptStatus(
  status: PaymentStatus,
): CheckoutAttemptStatus {
  if (status === "failed") {
    return "payment_failed";
  }

  if (status === "canceled") {
    return "payment_canceled";
  }

  if (status === "expired") {
    return "payment_expired";
  }

  if (status === "paid") {
    return "payment_paid";
  }

  if (status === "pending") {
    return "payment_pending";
  }

  return "manual_review";
}

export async function syncPortOnePayment({
  orderId,
  paymentId,
  source = "admin",
  webhook,
}: SyncPortOnePaymentInput): Promise<PortOnePaymentCompleteResult> {
  const payment = await fetchPortOnePayment(paymentId);
  const order = orderId
    ? await readPaymentOrder(orderId)
    : await readPaymentOrderByPaymentId(paymentId);

  if (order.portone_payment_id !== paymentId) {
    throw new PortOnePaymentError("주문과 결제 ID가 일치하지 않습니다.");
  }

  const paymentAmount = payment.amount?.total;

  if (paymentAmount !== order.total_krw) {
    await recordPaymentFailure({
      order,
      payment,
      paymentId,
      reason: "amount_mismatch",
      source,
      webhook,
    });
    throw new PortOnePaymentError("결제 금액이 주문 금액과 일치하지 않습니다.");
  }

  const normalizedStatus = normalizePortOnePaymentStatus(payment.status);
  const syncedPaymentMethod = inferOrderPaymentMethod(order.payment_method, payment);
  const depositAccount = readVirtualAccountInfo(payment);
  assertPaymentTransitionAllowed({
    currentPaymentStatus: order.payment_status,
    nextPaymentStatus: normalizedStatus,
    orderStatus: order.order_status,
  });

  if (normalizedStatus === "paid") {
    const transactionId = getPortOneTransactionId(payment);
    const result = await markOrderPaid({
      order,
      payment,
      paymentId,
      transactionId,
    });

    await updateCashPaymentFields({
      depositAccount,
      order,
      payment,
      paymentMethod: syncedPaymentMethod,
    });
    await syncCashReceiptFromPortOnePayment({ order, payment });

    if (!result.alreadyPaid) {
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
      await enqueueAdminNotificationJob({
        orderId: order.id,
        orderNumber: result.orderNumber,
        payload: {
          paymentId,
          paymentMethod: syncedPaymentMethod,
          total: order.total_krw,
        },
        template: "admin_payment_paid",
      });

      if (order.is_made_to_order) {
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
          template: "made_to_order_confirmed",
        });
      }

      if (!order.shipping_address1) {
        await ensureGiftRecipientAddressRequest({
          order: {
            contains_live_plant: order.contains_live_plant,
            id: order.id,
            is_gift: order.is_gift,
            order_number: result.orderNumber,
            orderer_email: order.orderer_email,
            orderer_phone: order.orderer_phone,
            recipient_name: order.recipient_name,
            recipient_phone: order.recipient_phone,
          },
          paidAt: new Date(readPaymentPaidAt(payment) ?? Date.now()),
        });
      }
    }

    await updateCheckoutAttemptPayment({
      orderId: order.id,
      paymentId,
      status: "payment_paid",
    });

    return {
      depositAccount,
      depositDueAt: readDepositDueAt(payment) ?? order.deposit_due_at,
      orderId: order.id,
      orderNumber: result.orderNumber,
      paymentMethod: syncedPaymentMethod,
      paymentId,
      paymentStatus: "paid",
      total: order.total_krw,
    };
  }

  await upsertPaymentRecord({
    order,
    payment,
    paymentId,
    paymentMethod: syncedPaymentMethod,
    status: normalizedStatus,
  });

  if (normalizedStatus === "pending") {
    await updatePendingPortOnePayment({
      depositAccount,
      order,
      payment,
      paymentMethod: syncedPaymentMethod,
      source,
      webhook,
    });

    await updateCheckoutAttemptPayment({
      orderId: order.id,
      paymentId,
      status: "payment_pending",
    });

    return {
      depositAccount,
      depositDueAt: readDepositDueAt(payment) ?? order.deposit_due_at,
      orderId: order.id,
      orderNumber: order.order_number,
      paymentMethod: syncedPaymentMethod,
      paymentId,
      paymentStatus: "pending",
      total: order.total_krw,
    };
  }

  await updateNonPaidTerminalPayment({
    order,
    payment,
    paymentMethod: syncedPaymentMethod,
    source,
    status: normalizedStatus,
    webhook,
  });

  await updateCheckoutAttemptPayment({
    orderId: order.id,
    paymentId,
    status: mapPaymentStatusToCheckoutAttemptStatus(normalizedStatus),
  });

  return {
    depositAccount,
    depositDueAt: readDepositDueAt(payment) ?? order.deposit_due_at,
    orderId: order.id,
    orderNumber: order.order_number,
    paymentMethod: syncedPaymentMethod,
    paymentId,
    paymentStatus: normalizedStatus,
    total: order.total_krw,
  };
}

async function readPaymentOrder(orderId: string): Promise<OrderPaymentRow> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_orders")
    .select(paymentOrderSelect)
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) {
    throw new PortOnePaymentError("주문을 찾지 못했습니다.", 404);
  }

  return parseOrderPaymentRow(data);
}

async function readPaymentOrderByPaymentId(
  paymentId: string,
): Promise<OrderPaymentRow> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_orders")
    .select(paymentOrderSelect)
    .eq("portone_payment_id", paymentId)
    .maybeSingle();

  if (error || !data) {
    throw new PortOnePaymentError("결제 ID에 해당하는 주문을 찾지 못했습니다.", 404);
  }

  return parseOrderPaymentRow(data);
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

  const items = parseOrderPaymentItems(data);
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
  const response = await fetchPortOneApi(
    `${getPortOneApiBaseUrl()}/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: {
        Authorization: `PortOne ${getPortOneApiSecret()}`,
      },
    },
    "결제 조회",
  );

  if (!response.ok) {
    throw new PortOnePaymentError(
      `PortOne 결제 조회 실패: ${await response.text()}`,
      502,
    );
  }

  return (await response.json()) as PortOnePayment;
}

async function preRegisterPortOnePayment({
  paymentId,
  storeId,
  totalAmount,
}: {
  paymentId: string;
  storeId: string;
  totalAmount: number;
}) {
  const response = await fetchPortOneApi(
    `${getPortOneApiBaseUrl()}/payments/${encodeURIComponent(
      paymentId,
    )}/pre-register`,
    {
      body: JSON.stringify({
        currency: "KRW",
        storeId,
        totalAmount,
      }),
      headers: {
        Authorization: `PortOne ${getPortOneApiSecret()}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    },
    "결제 사전등록",
  );

  if (!response.ok) {
    throw new PortOnePaymentError(
      `PortOne 결제 사전등록 실패: ${await response.text()}`,
      502,
    );
  }
}

async function fetchPortOneApi(
  input: RequestInfo | URL,
  init: RequestInit,
  label: string,
) {
  try {
    return await fetch(input, {
      ...init,
      signal: AbortSignal.timeout(portOneApiTimeoutMs),
    });
  } catch (error) {
    throw new PortOnePaymentError(
      `${label} 요청 시간이 초과되었습니다.`,
      error instanceof DOMException && error.name === "TimeoutError" ? 504 : 502,
    );
  }
}

async function markOrderPaid({
  order,
  payment,
  paymentId,
  transactionId,
}: {
  order: OrderPaymentRow;
  payment: PortOnePayment;
  paymentId: string;
  transactionId: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .rpc("mark_shop_order_paid", {
      p_order_id: order.id,
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

  const row = data as { already_paid?: boolean; order_number: string };

  return {
    alreadyPaid: Boolean(row.already_paid),
    orderNumber: row.order_number,
  };
}

async function recordPaymentFailure({
  order,
  payment,
  paymentId,
  reason,
  source,
  webhook,
}: {
  order: OrderPaymentRow;
  payment: PortOnePayment;
  paymentId: string;
  reason: string;
  source: string;
  webhook?: unknown;
}) {
  await upsertPaymentRecord({
    order,
    payment,
    paymentId,
    paymentMethod: order.payment_method,
    status: "failed",
  });

  const supabase = getSupabaseAdminClient();
  await supabase.from("shop_order_events").insert({
    actor: "system",
    event_type: "portone_payment_verification_failed",
    order_id: order.id,
    payload: {
      payment,
      paymentId,
      reason,
      source,
      webhook,
    },
  });

  await updateCheckoutAttemptPayment({
    errorCode: reason,
    errorMessage: "payment_verification_failed",
    orderId: order.id,
    paymentId,
    status: "manual_review",
  });
}

async function upsertPaymentRecord({
  order,
  payment,
  paymentId,
  paymentMethod,
  status,
}: {
  order: OrderPaymentRow;
  payment: PortOnePayment;
  paymentId: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("shop_payments").upsert(
    {
      amount_krw: payment.amount?.total ?? order.total_krw,
      order_id: order.id,
      payment_method: paymentMethod,
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

async function updatePendingPortOnePayment({
  depositAccount,
  order,
  payment,
  paymentMethod,
  source,
  webhook,
}: {
  depositAccount?: DepositAccount;
  order: OrderPaymentRow;
  payment: PortOnePayment;
  paymentMethod: PaymentMethod;
  source: string;
  webhook?: unknown;
}) {
  const supabase = getSupabaseAdminClient();
  const dueAt = readDepositDueAt(payment) ?? order.deposit_due_at;
  const isVirtualAccount = paymentMethod === "portone_virtual_account";
  const alreadyIssued = Boolean(order.virtual_account_account_number);

  const payload: Record<string, unknown> = {
    payment_method: paymentMethod,
    payment_status: "pending",
  };

  if (isVirtualAccount) {
    payload.deposit_due_at = dueAt;
    payload.deposit_review_status = "waiting";
    payload.virtual_account_issued_at = new Date().toISOString();
    payload.virtual_account_bank_name = depositAccount?.bankName ?? null;
    payload.virtual_account_account_number = depositAccount?.accountNumber ?? null;
    payload.virtual_account_account_holder =
      depositAccount?.accountHolder ?? null;
  }

  const { error } = await supabase
    .from("shop_orders")
    .update(payload)
    .eq("id", order.id);

  if (error) {
    throw new PortOnePaymentError(`결제 대기 상태 저장 실패: ${error.message}`, 500);
  }

  if (isVirtualAccount) {
    const { error: reserveError } = await supabase.rpc(
      "reserve_stock_for_virtual_account_order",
      {
        p_order_id: order.id,
      },
    );

    if (reserveError) {
      throw new PortOnePaymentError(
        `가상계좌 재고 확보 실패: ${reserveError.message}`,
        409,
      );
    }

    await syncCashReceiptFromPortOnePayment({ order, payment });

    if (!alreadyIssued && depositAccount) {
      await enqueueOrderNotificationJobs({
        orderId: order.id,
        orderNumber: order.order_number,
        payload: {
          account: depositAccount,
          depositDueAt: dueAt,
          total: order.total_krw,
        },
        recipient: {
          email: order.orderer_email,
          phone: order.orderer_phone,
        },
        template: "deposit_guide",
      });
    }
  }

  await supabase.from("shop_order_events").insert({
    actor: "system",
    event_type: isVirtualAccount
      ? "portone_virtual_account_issued"
      : "portone_payment_pending",
    order_id: order.id,
    payload: {
      account: depositAccount ?? null,
      depositDueAt: dueAt,
      payment,
      paymentMethod,
      source,
      webhook,
    },
  });
}

async function updateNonPaidTerminalPayment({
  order,
  payment,
  paymentMethod,
  source,
  status,
  webhook,
}: {
  order: OrderPaymentRow;
  payment: PortOnePayment;
  paymentMethod: PaymentMethod;
  source: string;
  status: Exclude<PaymentStatus, "paid" | "pending">;
  webhook?: unknown;
}) {
  const supabase = getSupabaseAdminClient();

  if (
    paymentMethod === "portone_virtual_account" &&
    (status === "expired" || status === "canceled")
  ) {
    await supabase.rpc("release_reserved_stock_for_order", {
      p_order_id: order.id,
      p_reason: status === "expired" ? "deposit_expired" : "payment_canceled",
    });
  }

  const { error } = await supabase
    .from("shop_orders")
    .update({
      canceled_at:
        status === "expired" || status === "canceled"
          ? new Date().toISOString()
          : null,
      fulfillment_status:
        status === "expired" || status === "canceled"
          ? "canceled"
          : "unfulfilled",
      order_status: status === "expired" ? "deposit_expired" : "pending_payment",
      payment_method: paymentMethod,
      payment_status: status,
    })
    .eq("id", order.id)
    .neq("payment_status", "paid");

  if (error) {
    throw new PortOnePaymentError(`결제 상태 저장 실패: ${error.message}`, 500);
  }

  await supabase.from("shop_order_events").insert({
    actor: "system",
    event_type:
      status === "expired"
        ? "portone_virtual_account_expired"
        : "portone_payment_status_updated",
    order_id: order.id,
    payload: {
      payment,
      paymentMethod,
      source,
      status,
      webhook,
    },
  });
}

async function updateCashPaymentFields({
  depositAccount,
  order,
  payment,
  paymentMethod,
}: {
  depositAccount?: DepositAccount;
  order: OrderPaymentRow;
  payment: PortOnePayment;
  paymentMethod: PaymentMethod;
}) {
  if (!isCashReceiptPaymentMethod(paymentMethod)) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const paidAt = readPaymentPaidAt(payment) ?? new Date().toISOString();
  const { error } = await supabase
    .from("shop_orders")
    .update({
      deposit_confirmed_at: paidAt,
      deposit_received_amount_krw: payment.amount?.total ?? order.total_krw,
      deposit_review_status: "matched",
      virtual_account_account_holder:
        depositAccount?.accountHolder ?? order.virtual_account_account_holder,
      virtual_account_account_number:
        depositAccount?.accountNumber ?? order.virtual_account_account_number,
      virtual_account_bank_name:
        depositAccount?.bankName ?? order.virtual_account_bank_name,
    })
    .eq("id", order.id);

  if (error) {
    throw new PortOnePaymentError(`계좌성 결제 정보 저장 실패: ${error.message}`, 500);
  }
}

async function syncCashReceiptFromPortOnePayment({
  order,
  payment,
}: {
  order: OrderPaymentRow;
  payment: PortOnePayment;
}) {
  if (
    !order.cash_receipt_requested ||
    !order.cash_receipt_type ||
    !order.cash_receipt_identifier_type ||
    !order.cash_receipt_identifier_masked
  ) {
    return;
  }

  const receipt = payment.cashReceipt;
  const nextStatus = normalizePortOneCashReceiptStatus(receipt?.status);
  const approvalNumber =
    receipt?.approvalNumber ?? receipt?.issueNumber ?? receipt?.pgReceiptId ?? null;
  const supabase = getSupabaseAdminClient();

  const { data: existing } = await supabase
    .from("shop_cash_receipts")
    .select("id")
    .eq("order_id", order.id)
    .eq("provider", "portone")
    .limit(1)
    .maybeSingle();

  const recordPayload = {
    amount_krw: payment.amount?.total ?? order.total_krw,
    approval_number: approvalNumber,
    identifier_masked: order.cash_receipt_identifier_masked,
    identifier_type: order.cash_receipt_identifier_type,
    order_id: order.id,
    provider: "portone",
    raw_payload: receipt ?? {},
    receipt_type: order.cash_receipt_type,
    status: nextStatus,
  };

  if (existing?.id) {
    await supabase
      .from("shop_cash_receipts")
      .update(recordPayload)
      .eq("id", existing.id);
  } else {
    await supabase.from("shop_cash_receipts").insert(recordPayload);
  }

  await supabase
    .from("shop_orders")
    .update({
      cash_receipt_approval_number: approvalNumber,
      cash_receipt_issued_at:
        nextStatus === "issued" ? new Date().toISOString() : null,
      cash_receipt_requested_at: new Date().toISOString(),
      cash_receipt_status: nextStatus,
    })
    .eq("id", order.id);
}

function getPortOneCheckoutConfig(
  paymentMethod: PaymentMethod,
  payMethod: PortOnePayMethod,
) {
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
  const channelKey = getPortOneChannelKey(paymentMethod, payMethod);

  if (!storeId || !channelKey) {
    throw new PortOnePaymentError(
      "PortOne Store ID와 Channel Key 환경변수가 설정되지 않았습니다.",
      503,
    );
  }

  return {
    channelKey,
    storeId,
  };
}

function getPortOneChannelKey(
  paymentMethod: PaymentMethod,
  payMethod: PortOnePayMethod,
) {
  if (paymentMethod === "portone_transfer" || payMethod === "TRANSFER") {
    return (
      process.env.NEXT_PUBLIC_PORTONE_TRANSFER_CHANNEL_KEY ||
      process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY
    );
  }

  if (
    paymentMethod === "portone_virtual_account" ||
    payMethod === "VIRTUAL_ACCOUNT"
  ) {
    return (
      process.env.NEXT_PUBLIC_PORTONE_VIRTUAL_ACCOUNT_CHANNEL_KEY ||
      process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY
    );
  }

  if (payMethod === "EASY_PAY") {
    return (
      process.env.NEXT_PUBLIC_PORTONE_EASY_PAY_CHANNEL_KEY ||
      process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY
    );
  }

  return (
    process.env.NEXT_PUBLIC_PORTONE_CARD_CHANNEL_KEY ||
    process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY
  );
}

function resolvePortOnePayMethod(
  paymentMethod: PaymentMethod,
  checkoutMode: string | null,
): PortOnePayMethod {
  if (checkoutMode === "naver_pay" || paymentMethod === "naver_pay") {
    return "EASY_PAY";
  }

  if (paymentMethod === "portone_transfer") {
    return "TRANSFER";
  }

  if (paymentMethod === "portone_virtual_account") {
    return "VIRTUAL_ACCOUNT";
  }

  return getCardLikePortOnePayMethod();
}

function getCardLikePortOnePayMethod(): PortOnePayMethod {
  const method =
    process.env.NEXT_PUBLIC_PORTONE_CARD_PAY_METHOD ||
    process.env.NEXT_PUBLIC_PORTONE_PAY_METHOD;

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

function normalizePortOneOrderPaymentMethod(
  paymentMethod: PaymentMethod,
  payMethod: PortOnePayMethod,
): PaymentMethod {
  if (paymentMethod === "naver_pay") {
    return "naver_pay";
  }

  if (payMethod === "TRANSFER") {
    return "portone_transfer";
  }

  if (payMethod === "VIRTUAL_ACCOUNT") {
    return "portone_virtual_account";
  }

  return "portone_card";
}

function inferOrderPaymentMethod(
  currentPaymentMethod: PaymentMethod,
  payment: PortOnePayment,
): PaymentMethod {
  if (currentPaymentMethod === "naver_pay") {
    return currentPaymentMethod;
  }

  const methodType = readPaymentMethodType(payment);

  if (methodType === "TRANSFER") {
    return "portone_transfer";
  }

  if (methodType === "VIRTUAL_ACCOUNT") {
    return "portone_virtual_account";
  }

  return "portone_card";
}

function readCashReceiptRequest(order: OrderPaymentRow) {
  if (!order.cash_receipt_requested || !order.cash_receipt_type) {
    return {};
  }

  const customerIdentifier = decryptSensitiveText(
    order.cash_receipt_identifier_encrypted,
  );

  if (!customerIdentifier) {
    throw new PortOnePaymentError("현금영수증 발급 정보를 확인해 주세요.");
  }

  return {
    cashReceiptType: toPortOneCashReceiptType(order.cash_receipt_type),
    customerIdentifier,
  };
}

function toPortOneCashReceiptType(
  type: Exclude<CashReceiptType, "none">,
): PortOneCashReceiptType {
  return type === "business" ? "CORPORATE" : "PERSONAL";
}

function readVirtualAccountInfo(
  payment: PortOnePayment,
): DepositAccount | undefined {
  const method = readPaymentMethodPayload(payment);
  const virtualAccount = firstObject(
    method?.virtualAccount,
    payment.virtualAccount,
    method,
  );

  const accountNumber = firstString(
    virtualAccount?.accountNumber,
    virtualAccount?.virtualAccountNumber,
    virtualAccount?.account,
    virtualAccount?.number,
  );
  const accountHolder = firstString(
    virtualAccount?.accountHolder,
    virtualAccount?.accountHolderName,
    virtualAccount?.remitteeName,
    virtualAccount?.holderName,
  );
  const bankName = readBankName(virtualAccount);

  if (!accountNumber || !accountHolder || !bankName) {
    return undefined;
  }

  return {
    accountHolder,
    accountNumber,
    bankName,
  };
}

function readDepositDueAt(payment: PortOnePayment) {
  const method = readPaymentMethodPayload(payment);
  const virtualAccount = firstObject(
    method?.virtualAccount,
    payment.virtualAccount,
    method,
  );

  return normalizeDateString(
    firstString(
      virtualAccount?.dueAt,
      virtualAccount?.dueDate,
      virtualAccount?.expiredAt,
      virtualAccount?.expiryDate,
      virtualAccount?.accountExpiry,
    ),
  );
}

function readPaymentPaidAt(payment: PortOnePayment) {
  return normalizeDateString(payment.paidAt ?? payment.updatedAt);
}

function readPaymentMethodPayload(payment: PortOnePayment) {
  return firstObject(payment.method, payment.paymentMethod);
}

function readPaymentMethodType(payment: PortOnePayment) {
  const type = firstString(readPaymentMethodPayload(payment)?.type)?.toUpperCase();

  if (!type) {
    return undefined;
  }

  if (type.includes("VIRTUAL")) {
    return "VIRTUAL_ACCOUNT";
  }

  if (type.includes("TRANSFER")) {
    return "TRANSFER";
  }

  if (type.includes("EASY")) {
    return "EASY_PAY";
  }

  if (type.includes("MOBILE")) {
    return "MOBILE";
  }

  if (type.includes("GIFT")) {
    return "GIFT_CERTIFICATE";
  }

  return "CARD";
}

function readBankName(payload: PortOnePaymentMethodPayload | undefined) {
  const bank = payload?.bank;

  if (typeof bank === "string") {
    return bank;
  }

  if (bank && typeof bank === "object") {
    const bankRecord = bank as Record<string, unknown>;
    return toBankDisplayName(
      firstString(bankRecord.name, bankRecord.code, bankRecord.bankName),
    );
  }

  return toBankDisplayName(firstString(payload?.bankName, payload?.bankCode));
}

function toBankDisplayName(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return (
    {
      HANA: "하나은행",
      IBK: "기업은행",
      KOOKMIN: "국민은행",
      NONGHYUP: "NH농협은행",
      SHINHAN: "신한은행",
      WOORI: "우리은행",
    }[value] ?? value
  );
}

function firstObject(
  ...values: unknown[]
): PortOnePaymentMethodPayload | undefined {
  for (const value of values) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as PortOnePaymentMethodPayload;
    }
  }

  return undefined;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return undefined;
}

function normalizeDateString(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const compact = /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2}))?$/.exec(
    value,
  );
  const normalized = compact
    ? `${compact[1]}-${compact[2]}-${compact[3]}${
        compact[4] ? `T${compact[4]}:${compact[5]}:${compact[6]}+09:00` : ""
      }`
    : value;
  const date = new Date(normalized);

  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function isCashReceiptPaymentMethod(paymentMethod: PaymentMethod) {
  return (
    paymentMethod === "portone_transfer" ||
    paymentMethod === "portone_virtual_account"
  );
}

function normalizePortOnePaymentStatus(
  status: string | undefined,
): PaymentStatus {
  const normalized = status?.replace(/^PAYMENT_STATUS_/, "");

  if (normalized === "PAID") {
    return "paid";
  }

  if (normalized === "FAILED") {
    return "failed";
  }

  if (normalized === "CANCELLED" || normalized === "CANCELED") {
    return "canceled";
  }

  if (
    normalized === "PARTIAL_CANCELLED" ||
    normalized === "PARTIAL_CANCELED"
  ) {
    return "partial_refunded";
  }

  if (
    normalized === "EXPIRED" ||
    normalized === "VIRTUAL_ACCOUNT_EXPIRED"
  ) {
    return "expired";
  }

  if (normalized === "VIRTUAL_ACCOUNT_ISSUED" || normalized === "READY") {
    return "pending";
  }

  return "pending";
}

function normalizePortOneCashReceiptStatus(status: string | undefined) {
  if (status === "ISSUED") {
    return "issued" as const;
  }

  if (status === "CANCELLED" || status === "CANCELED") {
    return "canceled" as const;
  }

  if (status === "FAILED") {
    return "failed" as const;
  }

  return "pending" as const;
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

function getPortOneApiBaseUrl() {
  return process.env.PORTONE_API_BASE_URL || "https://api.portone.io";
}

function getPortOneApiSecret() {
  const apiSecret = process.env.PORTONE_API_SECRET;

  if (!apiSecret) {
    throw new PortOnePaymentError(
      "PORTONE_API_SECRET 환경변수가 설정되지 않았습니다.",
      503,
    );
  }

  return apiSecret;
}

function generatePortOnePaymentId() {
  return `cp${Date.now()}${randomBytes(4).toString("hex")}`;
}
