import { NextResponse } from "next/server";
import { z } from "zod";
import { uploadMediaImage } from "@/lib/media/media-upload";
import {
  enqueueAdminNotificationJob,
} from "@/lib/notifications/order-notifications";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import { getProductById } from "@/lib/shop";
import {
  attachProductFeedbackImages,
  createProductFeedback,
} from "@/lib/shop/product-feedback";

export const runtime = "nodejs";

const feedbackRateLimit = {
  limit: 6,
  windowMs: 60_000,
};
const maxFeedbackBodyBytes = 5 * 20 * 1024 * 1024 + 32 * 1024;
const maxPhotoBytes = 20 * 1024 * 1024;
const maxPhotoCount = 5;
const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const feedbackPayloadSchema = z.object({
  authorName: z.string().trim().min(1).max(40),
  body: z.string().trim().min(5).max(1200),
  contact: z.string().trim().max(120).optional(),
  marketingConsent: z.boolean().optional(),
  productId: z.uuid(),
  productSlug: z.string().trim().min(1).max(120).regex(slugPattern),
  rating: z.number().int().min(1).max(5),
  website: z.string().trim().max(120).optional(),
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
      { error: "사진은 최대 5장, 각 20MB 이하로 올릴 수 있습니다." },
      { status: 413 },
    );
  }

  const parsedRequest = await readFeedbackRequest(request);

  if (!parsedRequest.ok) {
    return NextResponse.json({ error: parsedRequest.error }, { status: 400 });
  }

  const parsed = feedbackPayloadSchema.safeParse(parsedRequest.payload);

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

  const photoError = validatePhotos(parsedRequest.photos);

  if (photoError) {
    return NextResponse.json({ error: photoError }, { status: 400 });
  }

  const product = await getProductById(parsed.data.productId);

  if (!product || product.slug !== parsed.data.productSlug) {
    return NextResponse.json(
      { error: "상품 정보를 확인하지 못했습니다." },
      { status: 404 },
    );
  }

  try {
    const feedback = await createProductFeedback({
      authorName: parsed.data.authorName,
      body: parsed.data.body,
      contact: parsed.data.contact,
      marketingConsent: parsed.data.marketingConsent,
      productId: parsed.data.productId,
      rating: parsed.data.rating,
    });
    const assets = [];

    for (const [index, photo] of parsedRequest.photos.entries()) {
      const asset = await uploadMediaImage({
        alt: buildPhotoAlt(product.titleKo, parsed.data.authorName, index),
        buffer: Buffer.from(await photo.arrayBuffer()),
        filename: photo.name || `review-${index + 1}.webp`,
      });
      assets.push(asset);
    }

    await attachProductFeedbackImages({
      assets,
      feedbackId: feedback.id,
    });
    await enqueueAdminNotificationJob({
      payload: {
        authorName: parsed.data.authorName,
        imageCount: assets.length,
        productTitle: product.titleKo,
        rating: parsed.data.rating,
      },
      template: "admin_feedback_received",
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

async function readFeedbackRequest(request: Request): Promise<
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
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);

    if (!formData) {
      return { error: "요청 형식을 확인해 주세요.", ok: false };
    }

    return {
      ok: true,
      payload: {
        authorName: getFormValue(formData, "authorName"),
        body: getFormValue(formData, "body"),
        contact: getFormValue(formData, "contact"),
        marketingConsent: formData.get("marketingConsent") === "on",
        productId: getFormValue(formData, "productId"),
        productSlug: getFormValue(formData, "productSlug"),
        rating: Number(getFormValue(formData, "rating")),
        website: getFormValue(formData, "website"),
      },
      photos: formData
        .getAll("photos")
        .filter((value): value is File => value instanceof File && value.size > 0),
    };
  }

  const payload = await request.json().catch(() => null);

  if (!payload) {
    return { error: "요청 형식을 확인해 주세요.", ok: false };
  }

  return {
    ok: true,
    payload,
    photos: [],
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

function buildPhotoAlt(productTitle: string, authorName: string, index: number) {
  return `${productTitle} 구매평 사진 ${index + 1} - ${authorName}`;
}
