import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  deleteProductImageAssets,
  getProductById,
} from "@/lib/shop";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

type CleanupRequestBody = {
  productId?: unknown;
  storagePaths?: unknown;
};

const cleanupRateLimit = {
  limit: 20,
  windowMs: 60_000,
};

export async function POST(request: Request) {
  const rateLimit = await consumeRateLimit({
    key: getClientIp(request.headers),
    limit: cleanupRateLimit.limit,
    namespace: "admin-product-image-cleanup",
    windowMs: cleanupRateLimit.windowMs,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        message: "이미지 정리 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
        ok: false,
      },
      {
        headers: rateLimitHeaders(rateLimit),
        status: 429,
      },
    );
  }

  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    return NextResponse.json(
      {
        message: "관리자 인증이 필요합니다.",
        ok: false,
      },
      { status: 401 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        message: "Supabase Storage 설정이 필요합니다.",
        ok: false,
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as CleanupRequestBody | null;
  const productId = typeof body?.productId === "string" ? body.productId : "";
  const storagePaths = Array.isArray(body?.storagePaths)
    ? body.storagePaths.filter((value): value is string => typeof value === "string")
    : [];

  if (!productId || storagePaths.length === 0 || storagePaths.length > 20) {
    return NextResponse.json(
      {
        message: "정리할 상품 이미지 경로가 올바르지 않습니다.",
        ok: false,
      },
      { status: 400 },
    );
  }

  const product = await getProductById(productId);

  if (!product) {
    return NextResponse.json(
      {
        message: "상품을 찾을 수 없습니다.",
        ok: false,
      },
      { status: 404 },
    );
  }

  const savedStoragePaths = new Set(
    product.images
      .map((image) => image.storagePath)
      .filter((storagePath): storagePath is string => Boolean(storagePath)),
  );
  const removableStoragePaths = [
    ...new Set(
      storagePaths.filter(
        (storagePath) =>
          storagePath.startsWith("assets/") &&
          storagePath.endsWith(".webp") &&
          !savedStoragePaths.has(storagePath),
      ),
    ),
  ];

  if (removableStoragePaths.length === 0) {
    return NextResponse.json({
      ok: true,
      removed: 0,
    });
  }

  await deleteProductImageAssets(
    removableStoragePaths.map((storagePath) => ({
      alt: "",
      storagePath,
    })),
  );

  return NextResponse.json({
    ok: true,
    removed: removableStoragePaths.length,
  });
}
