import { NextResponse } from "next/server";
import { z } from "zod";
import {
  OrderDraftError,
  saveRefundAccountForOrder,
} from "@/lib/orders/order-store";
import { OrderLookupVerificationError } from "@/lib/orders/order-model";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const refundAccountSchema = z.object({
  accountHolder: z.string().trim().min(1).max(60),
  accountNumber: z.string().trim().min(4).max(80),
  bankName: z.string().trim().min(1).max(40),
  depositorName: z.string().trim().max(60).optional(),
  orderNumber: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^CP-[0-9]{8}-[0-9]{6}$/i),
  password: z.string().trim().regex(/^[0-9]{4}$/),
  phoneLast4: z.string().trim().regex(/^[0-9]{4}$/),
  refundAmount: z.number().int().min(0).optional(),
  refundReason: z.string().trim().max(300).optional(),
});

const refundAccountRateLimit = {
  limit: 6,
  windowMs: 10 * 60 * 1000,
};

export async function POST(request: Request) {
  const rateLimit = await consumeRateLimit({
    key: getClientIp(request.headers),
    limit: refundAccountRateLimit.limit,
    namespace: "refund-account",
    windowMs: refundAccountRateLimit.windowMs,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      {
        headers: rateLimitHeaders(rateLimit),
        status: 429,
      },
    );
  }

  const payload = await request.json().catch(() => null);
  const parsed = refundAccountSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "환불계좌 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  try {
    const result = await saveRefundAccountForOrder(parsed.data);

    return NextResponse.json(result, {
      headers: rateLimitHeaders(rateLimit),
    });
  } catch (error) {
    if (error instanceof OrderLookupVerificationError) {
      return NextResponse.json(
        { error: "주문 정보를 확인하지 못했습니다." },
        { status: 404 },
      );
    }

    if (error instanceof OrderDraftError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error(error);

    return NextResponse.json(
      { error: "환불계좌 저장 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
