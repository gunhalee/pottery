import { NextResponse, type NextRequest } from "next/server";
import { getCafe24ProductPurchaseStatus } from "@/lib/cafe24/product-status";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import { getProductBySlug } from "@/lib/shop";

const statusRateLimit = {
  limit: 60,
  windowMs: 60_000,
};

export async function GET(request: NextRequest) {
  const rateLimit = await consumeRateLimit({
    key: getClientIp(request.headers),
    limit: statusRateLimit.limit,
    namespace: "cafe24-product-status",
    windowMs: statusRateLimit.windowMs,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "상품 상태 조회 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      {
        headers: rateLimitHeaders(rateLimit),
        status: 429,
      },
    );
  }

  const slug = request.nextUrl.searchParams.get("slug")?.trim();

  if (!slug) {
    return NextResponse.json(
      { error: "상품 slug가 필요합니다." },
      { status: 400 },
    );
  }

  const product = await getProductBySlug(slug);

  if (!product || !product.published) {
    return NextResponse.json(
      { error: "상품을 찾지 못했습니다." },
      { status: 404 },
    );
  }

  const status = await getCafe24ProductPurchaseStatus(product, {
    cache: true,
  });

  return NextResponse.json(status, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
