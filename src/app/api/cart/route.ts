import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getAnonymousSessionFromRequest,
  getOrCreateAnonymousSession,
  setAnonymousSessionCookie,
} from "@/lib/shop/anonymous-session";
import {
  addCartItemForSession,
  clearCartForSession,
  getCartSnapshotForSession,
  removeCartItemForSession,
  updateCartItemQuantityForSession,
} from "@/lib/shop/cart-store";
import { emptyCartSnapshot } from "@/lib/shop/cart-model";
import {
  getProductBySlug,
  getProductPurchaseLimitQuantity,
} from "@/lib/shop";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const maxCartBodyBytes = 4 * 1024;
const cartRateLimit = {
  limit: 60,
  windowMs: 60_000,
};
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const cartItemPayloadSchema = z.object({
  madeToOrder: z.boolean().optional(),
  productOption: z.enum(["plant_excluded", "plant_included"]),
  productSlug: z.string().trim().min(1).max(120).regex(slugPattern),
  quantity: z.number().int().min(1).max(9999),
  shippingMethod: z.enum(["parcel", "pickup"]),
});

const cartQuantityPayloadSchema = z.object({
  key: z.string().trim().min(1).max(240),
  quantity: z.number().int().min(1).max(9999),
});

const cartDeletePayloadSchema = z.object({
  all: z.boolean().optional(),
  key: z.string().trim().min(1).max(240).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getAnonymousSessionFromRequest(request);
  const snapshot = await getCartSnapshotForSession(session?.id ?? null);

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await guardCartMutation(request);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const payload = await readJsonBody(request);

  if (!payload.ok) {
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }

  const parsed = cartItemPayloadSchema.safeParse(payload.value);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "장바구니에 담을 상품 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  const product = await getProductBySlug(parsed.data.productSlug);

  if (!product) {
    return NextResponse.json(
      { error: "상품 정보를 찾지 못했습니다." },
      { status: 404 },
    );
  }

  const containsLivePlant =
    parsed.data.productOption === "plant_included" && product.plantOption.enabled;
  const madeToOrder = Boolean(
    parsed.data.madeToOrder && product.madeToOrder.available,
  );
  const maxQuantity = madeToOrder
    ? 99
    : Math.max(1, getProductPurchaseLimitQuantity(product));

  try {
    const { session } = await getOrCreateAnonymousSession(request);
    const snapshot = await addCartItemForSession({
      madeToOrder,
      maxQuantity,
      productId: product.id,
      productOption: containsLivePlant ? "plant_included" : "plant_excluded",
      productSlug: product.slug,
      quantity: parsed.data.quantity,
      sessionId: session.id,
      shippingMethod: parsed.data.shippingMethod,
    });
    const response = NextResponse.json(snapshot, {
      headers: {
        ...rateLimitHeadersForMutation(request),
        "Cache-Control": "no-store",
      },
    });

    setAnonymousSessionCookie(response, session);

    return response;
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "장바구니 저장 중 오류가 발생했습니다." },
      { status: 503 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const rateLimitResponse = await guardCartMutation(request);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const session = await getAnonymousSessionFromRequest(request);

  if (!session) {
    return NextResponse.json(emptyCartSnapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const payload = await readJsonBody(request);

  if (!payload.ok) {
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }

  const parsed = cartQuantityPayloadSchema.safeParse(payload.value);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "수량을 변경할 상품 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  try {
    const maxQuantity = await getCartItemMaxQuantity(parsed.data.key);
    const snapshot = await updateCartItemQuantityForSession({
      key: parsed.data.key,
      maxQuantity,
      quantity: parsed.data.quantity,
      sessionId: session.id,
    });

    return NextResponse.json(snapshot, {
      headers: {
        ...rateLimitHeadersForMutation(request),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "장바구니 수량을 변경하지 못했습니다." },
      { status: 503 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const rateLimitResponse = await guardCartMutation(request);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const session = await getAnonymousSessionFromRequest(request);

  if (!session) {
    return NextResponse.json(emptyCartSnapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const payload = await readJsonBody(request, true);

  if (!payload.ok) {
    return NextResponse.json({ error: payload.error }, { status: payload.status });
  }

  const parsed = cartDeletePayloadSchema.safeParse(payload.value ?? { all: true });

  if (!parsed.success || (!parsed.data.all && !parsed.data.key)) {
    return NextResponse.json(
      { error: "삭제할 장바구니 항목을 확인해 주세요." },
      { status: 400 },
    );
  }

  try {
    const snapshot = parsed.data.all
      ? await clearCartForSession(session.id)
      : await removeCartItemForSession({
          key: parsed.data.key!,
          sessionId: session.id,
        });

    return NextResponse.json(snapshot, {
      headers: {
        ...rateLimitHeadersForMutation(request),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "장바구니 항목을 삭제하지 못했습니다." },
      { status: 503 },
    );
  }
}

async function guardCartMutation(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > maxCartBodyBytes) {
    return NextResponse.json(
      { error: "요청 본문이 너무 큽니다." },
      { status: 413 },
    );
  }

  const rateLimit = await consumeRateLimit({
    key: getClientIp(request.headers),
    limit: cartRateLimit.limit,
    namespace: "cart",
    windowMs: cartRateLimit.windowMs,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "장바구니 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      {
        headers: rateLimitHeaders(rateLimit),
        status: 429,
      },
    );
  }

  return null;
}

function rateLimitHeadersForMutation(request: NextRequest) {
  return {
    "X-RateLimit-Scope": getClientIp(request.headers),
  };
}

async function getCartItemMaxQuantity(key: string) {
  const [productSlug, , , orderKind] = key.split("|");

  if (!productSlug) {
    return 99;
  }

  const product = await getProductBySlug(productSlug);

  if (!product) {
    return 99;
  }

  return Math.max(
    1,
    getProductPurchaseLimitQuantity(product, {
      madeToOrder: orderKind === "made_to_order",
    }),
  );
}

async function readJsonBody(
  request: NextRequest,
  allowEmpty = false,
): Promise<
  | {
      ok: true;
      value: unknown;
    }
  | {
      error: string;
      ok: false;
      status: number;
    }
> {
  try {
    const text = await request.text();

    if (!text && allowEmpty) {
      return { ok: true, value: null };
    }

    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return {
      error: "요청 형식을 확인해 주세요.",
      ok: false,
      status: 400,
    };
  }
}
