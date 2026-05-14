import { NextResponse } from "next/server";
import { z } from "zod";
import { resendGiftRecipientAddressRequest } from "@/lib/orders/gift-recipient";
import { OrderLookupVerificationError } from "@/lib/orders/order-model";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import { validateRequestBodySize } from "@/lib/security/request-size";

const giftResendRateLimit = {
  limit: 4,
  windowMs: 10 * 60 * 1000,
};
const maxGiftResendBodyBytes = 2 * 1024;

const giftResendSchema = z.object({
  orderNumber: z.string().trim().min(1).max(40),
  password: z.string().regex(/^[0-9]{4}$/),
  phoneLast4: z.string().regex(/^[0-9]{4}$/),
  recipientPhoneLast4: z.string().regex(/^[0-9]{4}$/),
});

export async function POST(request: Request) {
  const rateLimit = await consumeRateLimit({
    key: getClientIp(request.headers),
    limit: giftResendRateLimit.limit,
    namespace: "gift-address-resend",
    windowMs: giftResendRateLimit.windowMs,
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

  const sizeCheck = validateRequestBodySize(
    request.headers,
    maxGiftResendBodyBytes,
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
  const parsed = giftResendSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "재발송 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  try {
    const result = await resendGiftRecipientAddressRequest(parsed.data);

    return NextResponse.json(
      {
        expiresAt: result.expiresAt,
        message: "기존 선물 배송 정보 입력 링크를 다시 보냈습니다.",
      },
      {
        headers: rateLimitHeaders(rateLimit),
      },
    );
  } catch (error) {
    if (error instanceof OrderLookupVerificationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "선물 배송 정보 링크 재발송 중 오류가 발생했습니다.",
      },
      { status: 400 },
    );
  }
}
