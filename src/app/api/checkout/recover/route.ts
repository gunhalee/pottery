import { NextResponse } from "next/server";
import { z } from "zod";

import type {
  DepositAccount,
  PaymentMethod,
  PaymentStatus,
} from "@/lib/orders/order-model";
import { updateCheckoutAttemptPayment } from "@/lib/orders/checkout-attempt-store";
import {
  assertCheckoutOrderOwnershipForRequest,
  CheckoutOwnershipError,
} from "@/lib/orders/checkout-ownership";
import { clearCheckoutRecoveryCookie } from "@/lib/orders/checkout-recovery-cookie";
import { PortOnePaymentError, syncPortOnePayment } from "@/lib/payments";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import { validateRequestBodySize } from "@/lib/security/request-size";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

const checkoutRecoverySchema = z
  .object({
    attemptId: z.uuid().optional(),
    orderId: z.uuid().optional(),
    paymentId: z.string().trim().min(1).max(160).optional(),
    recoveryToken: z.string().trim().min(20).max(200).optional(),
    sync: z.boolean().optional(),
  })
  .refine(
    (value) => Boolean(value.attemptId || value.orderId || value.paymentId),
    {
      message: "checkout recovery requires an order, payment, or attempt id",
    },
  );

const checkoutRecoveryRateLimit = {
  limit: 30,
  windowMs: 10 * 60 * 1000,
};
const maxCheckoutRecoveryBodyBytes = 2 * 1024;

type RecoveryOrderRow = {
  deposit_due_at: string | null;
  id: string;
  order_number: string;
  order_status: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  portone_payment_id: string | null;
  total_krw: number;
  virtual_account_account_holder: string | null;
  virtual_account_account_number: string | null;
  virtual_account_bank_name: string | null;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimit = await consumeRateLimit({
    key: getClientIp(request.headers),
    limit: checkoutRecoveryRateLimit.limit,
    namespace: "checkout-recovery",
    windowMs: checkoutRecoveryRateLimit.windowMs,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "잠시 후 다시 시도해 주세요." },
      {
        headers: rateLimitHeaders(rateLimit),
        status: 429,
      },
    );
  }

  const sizeCheck = validateRequestBodySize(
    request.headers,
    maxCheckoutRecoveryBodyBytes,
    { requireContentLength: true },
  );
  if (!sizeCheck.ok) {
    return NextResponse.json(
      { error: sizeCheck.error },
      {
        headers: rateLimitHeaders(rateLimit),
        status: sizeCheck.status,
      },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = checkoutRecoverySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "주문 상태 확인 정보를 다시 확인해 주세요." },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "주문 상태를 확인할 수 없습니다." },
      { status: 503 },
    );
  }

  let recoveryAttempt: Awaited<
    ReturnType<typeof assertCheckoutOrderOwnershipForRequest>
  >;
  try {
    recoveryAttempt = await assertCheckoutOrderOwnershipForRequest({
      checkoutAttemptId: parsed.data.attemptId,
      orderId: parsed.data.orderId,
      paymentId: parsed.data.paymentId,
      recoveryToken: parsed.data.recoveryToken,
      request,
    });
  } catch (error) {
    if (!(error instanceof CheckoutOwnershipError)) {
      throw error;
    }

    return NextResponse.json(
      {
        action: "manual_review",
        code: "RECOVERY_NOT_FOUND",
        message: "주문 상태를 확인할 수 없습니다.",
        retryable: false,
      },
      { status: error.status },
    );
  }

  const orderId = recoveryAttempt?.orderId ?? parsed.data.orderId;

  if (!orderId) {
    return NextResponse.json(
      {
        action: "submit_order",
        code: "NO_ORDER",
        message: "주문 기록이 아직 생성되지 않았습니다.",
        retryable: true,
      },
      { headers: rateLimitHeaders(rateLimit) },
    );
  }

  const order = await readRecoveryOrder(orderId);

  if (!order) {
    return NextResponse.json(
      {
        action: "submit_order",
        code: "NO_ORDER",
        message: "주문 기록이 아직 생성되지 않았습니다.",
        retryable: true,
      },
      { headers: rateLimitHeaders(rateLimit) },
    );
  }

  const paymentId =
    parsed.data.paymentId ?? recoveryAttempt?.paymentId ?? order.portone_payment_id;

  if (paymentId && order.portone_payment_id && paymentId !== order.portone_payment_id) {
    await updateCheckoutAttemptPayment({
      attemptId: recoveryAttempt?.attemptId,
      errorCode: "payment_id_mismatch",
      errorMessage: "payment id mismatch during checkout recovery",
      orderId: order.id,
      paymentId,
      status: "manual_review",
    });

    return NextResponse.json(
      {
        action: "manual_review",
        code: "PAYMENT_ID_MISMATCH",
        message: "주문과 결제 정보가 일치하지 않습니다.",
        order: toRecoveryOrder(order),
        retryable: false,
      },
      { status: 409 },
    );
  }

  if (order.payment_status === "paid") {
    const response = NextResponse.json(
      {
        action: "none",
        code: "ORDER_PAID",
        message: "주문 결제가 완료되었습니다.",
        order: toRecoveryOrder(order),
        payment: paymentId ? { paymentId } : null,
        retryable: false,
      },
      { headers: rateLimitHeaders(rateLimit) },
    );
    clearCheckoutRecoveryCookie(response);
    return response;
  }

  if (!paymentId) {
    return NextResponse.json(
      {
        action: "prepare_payment",
        code: "READY_TO_PREPARE",
        message: "결제를 다시 진행할 수 있습니다.",
        order: toRecoveryOrder(order),
        retryable: true,
      },
      { headers: rateLimitHeaders(rateLimit) },
    );
  }

  const shouldSyncWithProvider = parsed.data.sync !== false;

  if (
    !shouldSyncWithProvider ||
    (parsed.data.sync !== true && isRetryablePaymentStatus(order.payment_status))
  ) {
    const action = getActionForPaymentStatus(order.payment_status);
    const response = NextResponse.json(
      {
        action,
        code: getCodeForPaymentStatus(order.payment_status),
        message: getMessageForPaymentStatus(order.payment_status),
        order: toRecoveryOrder(order),
        payment: { paymentId },
        retryable: action === "retry_payment",
      },
      { headers: rateLimitHeaders(rateLimit) },
    );
    if (isSuccessfulRecoveredPayment(order)) {
      clearCheckoutRecoveryCookie(response);
    }
    return response;
  }

  if (shouldSyncWithProvider) {
    try {
      const synced = await syncPortOnePayment({
        orderId: order.id,
        paymentId,
        source: "browser",
      });

      const action = getActionForPaymentStatus(synced.paymentStatus);
      const response = NextResponse.json(
        {
          action,
          code: getCodeForPaymentStatus(synced.paymentStatus),
          message: getMessageForPaymentStatus(synced.paymentStatus),
          order: {
            depositAccount: synced.depositAccount,
            depositDueAt: synced.depositDueAt,
            orderId: synced.orderId,
            orderNumber: synced.orderNumber,
            paymentMethod: synced.paymentMethod,
            paymentStatus: synced.paymentStatus,
            total: synced.total,
          },
          payment: {
            paymentId: synced.paymentId,
          },
          retryable: action === "retry_payment",
        },
        { headers: rateLimitHeaders(rateLimit) },
      );
      if (isSuccessfulRecoveredPayment(synced)) {
        clearCheckoutRecoveryCookie(response);
      }
      return response;
    } catch (error) {
      if (error instanceof PortOnePaymentError) {
        const canRetryPayment =
          error.status >= 500 && isRetryablePaymentStatus(order.payment_status);
        const canRetrySync = error.status >= 500 && !canRetryPayment;
        await updateCheckoutAttemptPayment({
          attemptId: recoveryAttempt?.attemptId,
          errorCode: "sync_failed",
          errorMessage: error.message,
          orderId: order.id,
          paymentId,
          status: canRetryPayment
            ? getAttemptStatusForPaymentStatus(order.payment_status)
            : "manual_review",
        });

        return NextResponse.json(
          {
            action: canRetryPayment
              ? "retry_payment"
              : canRetrySync
                ? "sync_payment"
                : "manual_review",
            code: canRetryPayment
              ? "RETRY_PAYMENT"
              : canRetrySync
                ? "PAYMENT_STATUS_UNKNOWN"
                : "MANUAL_REVIEW",
            message: canRetryPayment
              ? "결제를 다시 진행할 수 있습니다."
              : canRetrySync
                ? "결제 상태를 확인하는 중 오류가 발생했습니다. 잠시 후 다시 확인해 주세요."
                : "주문 상태를 확인하는 중입니다. 잠시 후 다시 확인해 주세요.",
            order: toRecoveryOrder(order),
            payment: { paymentId },
            retryable: canRetryPayment || canRetrySync,
          },
          {
            headers: rateLimitHeaders(rateLimit),
            status: error.status >= 500 ? 202 : 200,
          },
        );
      }

      throw error;
    }
  }

  const response = NextResponse.json(
    {
      action: getActionForPaymentStatus(order.payment_status),
      code: getCodeForPaymentStatus(order.payment_status),
      message: getMessageForPaymentStatus(order.payment_status),
      order: toRecoveryOrder(order),
      payment: { paymentId },
      retryable: isRetryablePaymentStatus(order.payment_status),
    },
    { headers: rateLimitHeaders(rateLimit) },
  );
  if (isSuccessfulRecoveredPayment(order)) {
    clearCheckoutRecoveryCookie(response);
  }
  return response;
}

async function readRecoveryOrder(orderId: string): Promise<RecoveryOrderRow | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_orders")
    .select(
      [
        "id",
        "order_number",
        "order_status",
        "payment_status",
        "payment_method",
        "portone_payment_id",
        "deposit_due_at",
        "total_krw",
        "virtual_account_bank_name",
        "virtual_account_account_number",
        "virtual_account_account_holder",
      ].join(", "),
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? (data as unknown as RecoveryOrderRow) : null;
}

function toRecoveryOrder(order: RecoveryOrderRow) {
  return {
    depositAccount: readDepositAccount(order),
    depositDueAt: order.deposit_due_at,
    orderId: order.id,
    orderNumber: order.order_number,
    orderStatus: order.order_status,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    total: order.total_krw,
  };
}

function readDepositAccount(order: RecoveryOrderRow): DepositAccount | undefined {
  if (
    !order.virtual_account_bank_name ||
    !order.virtual_account_account_number ||
    !order.virtual_account_account_holder
  ) {
    return undefined;
  }

  return {
    accountHolder: order.virtual_account_account_holder,
    accountNumber: order.virtual_account_account_number,
    bankName: order.virtual_account_bank_name,
  };
}

function getActionForPaymentStatus(status: PaymentStatus) {
  if (status === "paid") {
    return "none";
  }

  if (status === "pending") {
    return "sync_payment";
  }

  if (isRetryablePaymentStatus(status)) {
    return "retry_payment";
  }

  return "manual_review";
}

function getCodeForPaymentStatus(status: PaymentStatus) {
  if (status === "paid") {
    return "ORDER_PAID";
  }

  if (status === "pending") {
    return "PAYMENT_PENDING";
  }

  if (status === "failed" || status === "canceled" || status === "expired") {
    return "RETRY_PAYMENT";
  }

  return "MANUAL_REVIEW";
}

function getMessageForPaymentStatus(status: PaymentStatus) {
  if (status === "paid") {
    return "주문 결제가 완료되었습니다.";
  }

  if (status === "pending") {
    return "결제 상태를 확인하고 있습니다.";
  }

  if (isRetryablePaymentStatus(status)) {
    return "결제를 다시 진행할 수 있습니다.";
  }

  return "주문 상태를 확인하는 중입니다. 잠시 후 다시 확인해 주세요.";
}

function isRetryablePaymentStatus(status: PaymentStatus) {
  return status === "failed" || status === "canceled" || status === "expired";
}

function isSuccessfulRecoveredPayment(input: {
  payment_method?: PaymentMethod;
  paymentMethod?: PaymentMethod;
  payment_status?: PaymentStatus;
  paymentStatus?: PaymentStatus;
}) {
  const paymentStatus = input.paymentStatus ?? input.payment_status;
  const paymentMethod = input.paymentMethod ?? input.payment_method;

  return (
    paymentStatus === "paid" ||
    (paymentStatus === "pending" &&
      paymentMethod === "portone_virtual_account")
  );
}

function getAttemptStatusForPaymentStatus(status: PaymentStatus) {
  if (status === "failed") {
    return "payment_failed";
  }

  if (status === "canceled") {
    return "payment_canceled";
  }

  if (status === "expired") {
    return "payment_expired";
  }

  return "manual_review";
}
