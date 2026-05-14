import { NextResponse } from "next/server";
import { z } from "zod";
import { completePortOnePayment, PortOnePaymentError } from "@/lib/payments";
import {
  assertCheckoutOrderOwnershipForRequest,
  CheckoutOwnershipError,
} from "@/lib/orders/checkout-ownership";
import { clearCheckoutRecoveryCookie } from "@/lib/orders/checkout-recovery-cookie";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import { validateRequestBodySize } from "@/lib/security/request-size";

const completePaymentSchema = z.object({
  checkoutAttemptId: z.uuid().optional(),
  orderId: z.uuid().optional(),
  paymentId: z.string().trim().min(1).max(80),
  recoveryToken: z.string().trim().min(20).max(200).optional(),
});

const completePaymentRateLimit = {
  limit: 20,
  windowMs: 10 * 60 * 1000,
};
const maxCompletePaymentBodyBytes = 2 * 1024;

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimit = await consumeRateLimit({
    key: getClientIp(request.headers),
    limit: completePaymentRateLimit.limit,
    namespace: "portone-payment-complete",
    windowMs: completePaymentRateLimit.windowMs,
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
    maxCompletePaymentBodyBytes,
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
  const parsed = completePaymentSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "결제 완료 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  try {
    const attempt = await assertCheckoutOrderOwnershipForRequest({
      checkoutAttemptId: parsed.data.checkoutAttemptId,
      orderId: parsed.data.orderId,
      paymentId: parsed.data.paymentId,
      recoveryToken: parsed.data.recoveryToken,
      request,
    });

    const result = await completePortOnePayment({
      orderId: parsed.data.orderId ?? attempt.orderId ?? undefined,
      paymentId: parsed.data.paymentId,
    });

    const response = NextResponse.json(result, {
      headers: rateLimitHeaders(rateLimit),
    });

    if (isSuccessfulCheckoutCompletion(result)) {
      clearCheckoutRecoveryCookie(response);
    }

    return response;
  } catch (error) {
    if (error instanceof CheckoutOwnershipError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    if (error instanceof PortOnePaymentError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error(error);

    return NextResponse.json(
      { error: "결제 검증 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

function isSuccessfulCheckoutCompletion(
  result: Awaited<ReturnType<typeof completePortOnePayment>>,
) {
  return (
    result.paymentStatus === "paid" ||
    (result.paymentStatus === "pending" &&
      result.paymentMethod === "portone_virtual_account")
  );
}
