import { NextResponse } from "next/server";
import { z } from "zod";
import {
  Cafe24OrderLookupVerificationError,
  lookupCafe24Order,
} from "@/lib/cafe24/order-lookup";
import { Cafe24ApiError } from "@/lib/cafe24/client";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const maxLookupBodyBytes = 4 * 1024;
const lookupRateLimit = {
  limit: 8,
  windowMs: 60_000,
};
const lookupPayloadSchema = z.object({
  buyerName: z.string().trim().max(80).optional(),
  email: z.string().trim().toLowerCase().max(254).optional(),
  orderId: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9-]+$/),
  phone: z.string().trim().max(20).optional(),
});

export async function POST(request: Request) {
  const rateLimit = await consumeRateLimit({
    key: getClientIp(request.headers),
    limit: lookupRateLimit.limit,
    namespace: "order-lookup",
    windowMs: lookupRateLimit.windowMs,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "주문 조회 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      {
        headers: rateLimitHeaders(rateLimit),
        status: 429,
      },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > maxLookupBodyBytes) {
    return NextResponse.json(
      { error: "요청 본문이 너무 큽니다." },
      { status: 413 },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 형식을 확인해 주세요." },
      { status: 400 },
    );
  }

  const parsed = lookupPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "주문번호와 연락처를 입력해 주세요." },
      { status: 400 },
    );
  }

  try {
    const result = await lookupCafe24Order(parsed.data);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (
      error instanceof Cafe24OrderLookupVerificationError ||
      (error instanceof Cafe24ApiError && [404, 422].includes(error.status))
    ) {
      return NextResponse.json(
        { error: "주문 정보를 확인하지 못했습니다." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "주문 조회 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
