import { NextResponse } from "next/server";
import { z } from "zod";
import { completePortOnePayment, PortOnePaymentError } from "@/lib/payments";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const completePaymentSchema = z.object({
  orderId: z.uuid(),
  paymentId: z.string().trim().min(1).max(80),
});

const completePaymentRateLimit = {
  limit: 20,
  windowMs: 10 * 60 * 1000,
};

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

  const payload = await request.json().catch(() => null);
  const parsed = completePaymentSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "결제 완료 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  try {
    const result = await completePortOnePayment(parsed.data);

    return NextResponse.json(result, {
      headers: rateLimitHeaders(rateLimit),
    });
  } catch (error) {
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
