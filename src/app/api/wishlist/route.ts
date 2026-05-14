import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import { validateRequestBodySize } from "@/lib/security/request-size";
import { getProductBySlug } from "@/lib/shop";
import {
  getAnonymousSessionFromRequest,
  getOrCreateAnonymousSession,
  setAnonymousSessionCookie,
} from "@/lib/shop/anonymous-session";
import {
  getWishlistItemStateForSession,
  setWishlistItemForSession,
} from "@/lib/shop/wishlist-store";

export const runtime = "nodejs";

const maxWishlistBodyBytes = 2 * 1024;
const wishlistRateLimit = {
  limit: 30,
  windowMs: 60_000,
};
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const wishlistQuerySchema = z.object({
  productSlug: z.string().trim().min(1).max(120).regex(slugPattern),
});

const wishlistPayloadSchema = wishlistQuerySchema.extend({
  wished: z.boolean(),
});

export async function GET(request: NextRequest) {
  const parsed = wishlistQuerySchema.safeParse({
    productSlug: request.nextUrl.searchParams.get("productSlug"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "상품 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  const session = await getAnonymousSessionFromRequest(request);

  if (!session) {
    return NextResponse.json(
      { wished: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const product = await getProductBySlug(parsed.data.productSlug);

  if (!product) {
    return NextResponse.json(
      { error: "상품 정보를 확인하지 못했습니다." },
      { status: 404 },
    );
  }

  try {
    const state = await getWishlistItemStateForSession(session.id, product.id);
    return NextResponse.json(state, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "찜 정보를 확인하지 못했습니다." },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  const rateLimit = await consumeRateLimit({
    key: getClientIp(request.headers),
    limit: wishlistRateLimit.limit,
    namespace: "wishlist",
    windowMs: wishlistRateLimit.windowMs,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "찜 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      {
        headers: rateLimitHeaders(rateLimit),
        status: 429,
      },
    );
  }

  const sizeCheck = validateRequestBodySize(
    request.headers,
    maxWishlistBodyBytes,
    { requireContentLength: true },
  );
  if (!sizeCheck.ok) {
    return NextResponse.json(
      { error: sizeCheck.error },
      { status: sizeCheck.status },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > maxWishlistBodyBytes) {
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

  const parsed = wishlistPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "상품 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  const product = await getProductBySlug(parsed.data.productSlug);

  if (!product) {
    return NextResponse.json(
      { error: "상품 정보를 확인하지 못했습니다." },
      { status: 404 },
    );
  }

  try {
    const { session } = await getOrCreateAnonymousSession(request);
    const state = await setWishlistItemForSession({
      productId: product.id,
      sessionId: session.id,
      wished: parsed.data.wished,
    });
    const response = NextResponse.json(state, {
      headers: rateLimitHeaders(rateLimit),
    });

    setAnonymousSessionCookie(response, session);

    return response;
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "찜 저장 설정을 확인해 주세요." },
      { status: 503 },
    );
  }
}
