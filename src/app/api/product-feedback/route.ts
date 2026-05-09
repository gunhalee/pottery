import { NextResponse } from "next/server";
import { z } from "zod";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import { getProductById } from "@/lib/shop";
import { createProductFeedback } from "@/lib/shop/product-feedback";

export const runtime = "nodejs";

const feedbackRateLimit = {
  limit: 6,
  windowMs: 60_000,
};
const maxFeedbackBodyBytes = 8 * 1024;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const baseFeedbackPayloadSchema = z.object({
  authorName: z.string().trim().min(1).max(40),
  body: z.string().trim().min(5).max(1200),
  contact: z.string().trim().max(120).optional(),
  productId: z.string().uuid(),
  productSlug: z.string().trim().min(1).max(120).regex(slugPattern),
  website: z.string().trim().max(120).optional(),
});

const feedbackPayloadSchema = baseFeedbackPayloadSchema.extend({
  rating: z.number().int().min(1).max(5),
});

export async function POST(request: Request) {
  const rateLimit = await consumeRateLimit({
    key: getClientIp(request.headers),
    limit: feedbackRateLimit.limit,
    namespace: "product-feedback",
    windowMs: feedbackRateLimit.windowMs,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "작성 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      {
        headers: rateLimitHeaders(rateLimit),
        status: 429,
      },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > maxFeedbackBodyBytes) {
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

  const parsed = feedbackPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "입력 내용을 확인해 주세요." },
      { status: 400 },
    );
  }

  if (parsed.data.website) {
    return NextResponse.json(
      { message: "접수되었습니다. 검토 후 반영됩니다." },
      { headers: rateLimitHeaders(rateLimit) },
    );
  }

  const product = await getProductById(parsed.data.productId);

  if (!product || product.slug !== parsed.data.productSlug) {
    return NextResponse.json(
      { error: "상품 정보를 확인하지 못했습니다." },
      { status: 404 },
    );
  }

  try {
    await createProductFeedback({
      authorName: parsed.data.authorName,
      body: parsed.data.body,
      contact: parsed.data.contact,
      productId: parsed.data.productId,
      rating: parsed.data.rating,
    });

    return NextResponse.json(
      { message: "접수되었습니다. 검토 후 반영됩니다." },
      { headers: rateLimitHeaders(rateLimit) },
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "저장 설정을 확인해 주세요." },
      { status: 503 },
    );
  }
}
