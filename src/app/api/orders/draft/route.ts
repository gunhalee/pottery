import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createOrderDraft,
  OrderDraftError,
} from "@/lib/orders/order-store";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

const orderDraftSchema = z.object({
  cashReceiptIdentifier: z.string().trim().max(80).optional(),
  cashReceiptIdentifierType: z
    .enum(["phone", "cash_receipt_card", "business_registration"])
    .optional(),
  cashReceiptType: z.enum(["none", "personal", "business"]).optional(),
  checkoutMode: z.enum(["standard", "gift", "naver_pay"]),
  giftMessage: z.string().max(200).optional(),
  lookupPassword: z.string().regex(/^[0-9]{4}$/),
  madeToOrder: z.boolean().optional(),
  madeToOrderAcknowledged: z.boolean().optional(),
  ordererEmail: z.email().max(120),
  ordererName: z.string().trim().min(1).max(40),
  ordererPhone: z.string().trim().min(8).max(30),
  paymentMethod: z.enum(["portone", "naver_pay", "bank_transfer"]).optional(),
  productOption: z.enum(["plant_excluded", "plant_included"]).optional(),
  productSlug: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(1).max(99),
  recipientName: z.string().trim().max(40).optional(),
  recipientPhone: z.string().trim().max(30).optional(),
  shippingAddress1: z.string().trim().max(160).optional(),
  shippingAddress2: z.string().trim().max(160).optional(),
  shippingMemo: z.string().trim().max(120).optional(),
  shippingMethod: z.enum(["parcel", "pickup"]),
  shippingPostcode: z.string().trim().max(12).optional(),
});

const orderDraftRateLimit = {
  limit: 10,
  windowMs: 10 * 60 * 1000,
};

export async function POST(request: Request) {
  const rateLimit = await consumeRateLimit({
    key: getClientIp(request.headers),
    limit: orderDraftRateLimit.limit,
    namespace: "order-draft",
    windowMs: orderDraftRateLimit.windowMs,
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
  const parsed = orderDraftSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "주문 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  try {
    const order = await createOrderDraft(parsed.data);

    return NextResponse.json(
      {
        order,
      },
      {
        headers: rateLimitHeaders(rateLimit),
      },
    );
  } catch (error) {
    if (error instanceof OrderDraftError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error(error);

    return NextResponse.json(
      { error: "주문 접수 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
