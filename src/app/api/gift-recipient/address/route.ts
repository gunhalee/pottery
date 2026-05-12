import { NextResponse } from "next/server";
import { z } from "zod";
import { submitGiftRecipientAddress } from "@/lib/orders/gift-recipient";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const giftAddressRateLimit = {
  limit: 8,
  windowMs: 10 * 60 * 1000,
};

const giftAddressSchema = z.object({
  recipientName: z.string().trim().min(1).max(40),
  recipientPhone: z.string().trim().min(8).max(30),
  shippingAddress1: z.string().trim().min(1).max(160),
  shippingAddress2: z.string().trim().max(160).optional(),
  shippingMemo: z.string().trim().max(120).optional(),
  shippingPostcode: z.string().trim().min(1).max(12),
  token: z.string().trim().min(20).max(200),
});

export async function POST(request: Request) {
  const rateLimit = await consumeRateLimit({
    key: getClientIp(request.headers),
    limit: giftAddressRateLimit.limit,
    namespace: "gift-address",
    windowMs: giftAddressRateLimit.windowMs,
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
  const parsed = giftAddressSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "배송 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  try {
    await submitGiftRecipientAddress(parsed.data);

    return NextResponse.json(
      {
        message: "배송 정보가 입력되었습니다.",
      },
      {
        headers: rateLimitHeaders(rateLimit),
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "배송 정보 저장 중 오류가 발생했습니다.",
      },
      { status: 400 },
    );
  }
}
