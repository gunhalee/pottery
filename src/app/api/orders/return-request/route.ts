import { NextResponse } from "next/server";
import { z } from "zod";
import { uploadMediaImage } from "@/lib/media/media-upload";
import {
  attachReturnRequestImages,
  createReturnRequest,
  ReturnRequestError,
} from "@/lib/orders/return-request";
import { OrderLookupVerificationError } from "@/lib/orders/order-model";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const returnRequestRateLimit = {
  limit: 6,
  windowMs: 10 * 60 * 1000,
};
const maxReturnRequestBodyBytes = 5 * 20 * 1024 * 1024 + 64 * 1024;
const maxPhotoBytes = 20 * 1024 * 1024;
const maxPhotoCount = 5;
const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const returnRequestSchema = z.object({
  customerContact: z.string().trim().min(4).max(120),
  customerName: z.string().trim().min(1).max(40),
  detail: z.string().trim().min(5).max(1200),
  orderNumber: z.string().trim().min(1).max(40),
  password: z.string().regex(/^[0-9]{4}$/),
  phoneLast4: z.string().regex(/^[0-9]{4}$/),
  reason: z.string().trim().min(2).max(80),
  requestType: z.enum(["exchange", "return", "refund", "damage", "other"]),
});

export async function POST(request: Request) {
  const rateLimit = await consumeRateLimit({
    key: getClientIp(request.headers),
    limit: returnRequestRateLimit.limit,
    namespace: "return-request",
    windowMs: returnRequestRateLimit.windowMs,
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

  const contentLength = Number(request.headers.get("content-length") ?? 0);

  if (contentLength > maxReturnRequestBodyBytes) {
    return NextResponse.json(
      { error: "사진은 최대 5장, 각 20MB 이하로 올릴 수 있습니다." },
      { status: 413 },
    );
  }

  const parsedRequest = await readReturnRequest(request);

  if (!parsedRequest.ok) {
    return NextResponse.json({ error: parsedRequest.error }, { status: 400 });
  }

  const parsed = returnRequestSchema.safeParse(parsedRequest.payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "접수 내용을 확인해 주세요." },
      { status: 400 },
    );
  }

  const photoError = validatePhotos(parsedRequest.photos);

  if (photoError) {
    return NextResponse.json({ error: photoError }, { status: 400 });
  }

  try {
    const returnRequest = await createReturnRequest(parsed.data);
    const assets = [];

    for (const [index, photo] of parsedRequest.photos.entries()) {
      const asset = await uploadMediaImage({
        alt: `${returnRequest.orderNumber} 교환·반품 사진 ${index + 1}`,
        buffer: Buffer.from(await photo.arrayBuffer()),
        filename: photo.name || `return-request-${index + 1}.webp`,
        reserved: true,
      });
      assets.push(asset);
    }

    await attachReturnRequestImages({
      assets,
      returnRequestId: returnRequest.id,
    });

    return NextResponse.json(
      {
        message: "교환·반품 문의가 접수되었습니다. 확인 후 안내드리겠습니다.",
      },
      {
        headers: rateLimitHeaders(rateLimit),
      },
    );
  } catch (error) {
    if (error instanceof OrderLookupVerificationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 },
      );
    }

    if (error instanceof ReturnRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error(error);

    return NextResponse.json(
      { error: "교환·반품 접수 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

async function readReturnRequest(request: Request): Promise<
  | {
      ok: true;
      payload: unknown;
      photos: File[];
    }
  | {
      error: string;
      ok: false;
    }
> {
  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return { error: "요청 형식을 확인해 주세요.", ok: false };
  }

  return {
    ok: true,
    payload: {
      customerContact: getFormValue(formData, "customerContact"),
      customerName: getFormValue(formData, "customerName"),
      detail: getFormValue(formData, "detail"),
      orderNumber: getFormValue(formData, "orderNumber"),
      password: getFormValue(formData, "password"),
      phoneLast4: getFormValue(formData, "phoneLast4"),
      reason: getFormValue(formData, "reason"),
      requestType: getFormValue(formData, "requestType"),
    },
    photos: formData
      .getAll("photos")
      .filter((value): value is File => value instanceof File && value.size > 0),
  };
}

function validatePhotos(photos: File[]) {
  if (photos.length > maxPhotoCount) {
    return "사진은 최대 5장까지 올릴 수 있습니다.";
  }

  for (const photo of photos) {
    if (!acceptedImageTypes.has(photo.type)) {
      return "사진은 jpg, png, webp 형식만 올릴 수 있습니다.";
    }

    if (photo.size > maxPhotoBytes) {
      return "사진은 각 20MB 이하로 올릴 수 있습니다.";
    }
  }

  return null;
}

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
