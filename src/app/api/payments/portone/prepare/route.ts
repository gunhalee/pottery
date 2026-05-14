import { NextResponse } from "next/server";
import { z } from "zod";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import { PortOnePaymentError, preparePortOnePayment } from "@/lib/payments";

const preparePaymentSchema = z.object({
  forceNewPaymentId: z.boolean().optional(),
  orderId: z.uuid(),
});

const preparePaymentRateLimit = {
  limit: 15,
  windowMs: 10 * 60 * 1000,
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rateLimit = await consumeRateLimit({
    key: getClientIp(request.headers),
    limit: preparePaymentRateLimit.limit,
    namespace: "portone-payment-prepare",
    windowMs: preparePaymentRateLimit.windowMs,
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
  const parsed = preparePaymentSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "결제 준비 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  try {
    const result = await preparePortOnePayment({
      forceNewPaymentId: parsed.data.forceNewPaymentId,
      orderId: parsed.data.orderId,
      origin: getRequestOrigin(request),
    });

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
      { error: "결제창 로딩 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

function getRequestOrigin(request: Request) {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;

  if (configuredOrigin) {
    return configuredOrigin.replace(/\/$/, "");
  }

  return new URL(request.url).origin;
}
