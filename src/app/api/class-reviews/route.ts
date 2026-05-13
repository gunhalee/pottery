import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { uploadMediaImage } from "@/lib/media/media-upload";
import { enqueueAdminNotificationJob } from "@/lib/notifications/order-notifications";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import {
  getOrCreateAnonymousSession,
  setAnonymousSessionCookie,
} from "@/lib/shop/anonymous-session";
import {
  attachClassReviewImages,
  createClassReview,
} from "@/lib/shop/class-reviews";
import { getClassSessionById } from "@/lib/shop/class-sessions";

export const runtime = "nodejs";

const classReviewRateLimit = {
  limit: 6,
  windowMs: 60_000,
};
const maxReviewBodyBytes = 5 * 20 * 1024 * 1024 + 32 * 1024;
const maxPhotoBytes = 20 * 1024 * 1024;
const maxPhotoCount = 5;
const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const classReviewPayloadSchema = z.object({
  body: z.string().trim().min(5).max(1200),
  classSessionId: z.uuid().optional().or(z.literal("")),
  classTitle: z.string().trim().max(80).optional(),
  contact: z.string().trim().max(120).optional(),
  marketingConsent: z.boolean().optional(),
  participantName: z.string().trim().min(1).max(40),
  website: z.string().trim().max(120).optional(),
});

export async function POST(request: NextRequest) {
  const rateLimit = await consumeRateLimit({
    key: getClientIp(request.headers),
    limit: classReviewRateLimit.limit,
    namespace: "class-reviews",
    windowMs: classReviewRateLimit.windowMs,
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

  if (contentLength > maxReviewBodyBytes) {
    return NextResponse.json(
      { error: "사진은 최대 5장, 각 20MB 이하로 올릴 수 있습니다." },
      { status: 413 },
    );
  }

  const parsedRequest = await readClassReviewRequest(request);

  if (!parsedRequest.ok) {
    return NextResponse.json({ error: parsedRequest.error }, { status: 400 });
  }

  const parsed = classReviewPayloadSchema.safeParse(parsedRequest.payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "입력 내용을 확인해 주세요." },
      { status: 400 },
    );
  }

  if (parsed.data.website) {
    return NextResponse.json(
      { message: "접수되었습니다. 검토 후 반영합니다." },
      { headers: rateLimitHeaders(rateLimit) },
    );
  }

  const photoError = validatePhotos(parsedRequest.photos);

  if (photoError) {
    return NextResponse.json({ error: photoError }, { status: 400 });
  }

  try {
    const { session } = await getOrCreateAnonymousSession(request);
    const classSession =
      parsed.data.classSessionId && parsed.data.classSessionId !== ""
        ? await getClassSessionById(parsed.data.classSessionId)
        : null;

    if (parsed.data.classSessionId && !classSession) {
      return NextResponse.json(
        { error: "선택한 클래스 회차를 찾지 못했습니다." },
        { status: 404 },
      );
    }

    if (classSession && classSession.status !== "published") {
      return NextResponse.json(
        { error: "현재 선택할 수 없는 클래스 회차입니다." },
        { status: 400 },
      );
    }

    const review = await createClassReview({
      body: parsed.data.body,
      classSessionId: classSession?.id ?? null,
      classTitle: parsed.data.classTitle,
      contact: parsed.data.contact,
      marketingConsent: parsed.data.marketingConsent,
      participantName: parsed.data.participantName,
    });
    const assets = [];

    for (const [index, photo] of parsedRequest.photos.entries()) {
      const asset = await uploadMediaImage({
        alt: buildClassReviewPhotoAlt(
          parsed.data.classTitle || classSession?.title,
          parsed.data.participantName,
          index,
        ),
        buffer: Buffer.from(await photo.arrayBuffer()),
        filename: photo.name || `class-review-${index + 1}.webp`,
        reserved: true,
      });
      assets.push(asset);
    }

    await attachClassReviewImages({
      assets,
      reviewId: review.id,
    });
    await enqueueAdminNotificationJob({
      payload: {
        classSessionId: classSession?.id ?? null,
        classTitle: parsed.data.classTitle ?? classSession?.title ?? null,
        imageCount: assets.length,
        participantName: parsed.data.participantName,
        reviewBody: parsed.data.body,
      },
      template: "admin_class_review_received",
    });

    const response = NextResponse.json(
      { message: "접수되었습니다. 검토 후 반영합니다." },
      { headers: rateLimitHeaders(rateLimit) },
    );

    setAnonymousSessionCookie(response, session);

    return response;
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "저장 설정을 확인해 주세요." },
      { status: 503 },
    );
  }
}

async function readClassReviewRequest(request: Request): Promise<
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

  if (!contentType.includes("multipart/form-data")) {
    return { error: "요청 형식을 확인해 주세요.", ok: false };
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return { error: "요청 형식을 확인해 주세요.", ok: false };
  }

  return {
    ok: true,
    payload: {
      body: getFormValue(formData, "body"),
      classSessionId: getFormValue(formData, "classSessionId"),
      classTitle: getFormValue(formData, "classTitle"),
      contact: getFormValue(formData, "contact"),
      marketingConsent: formData.get("marketingConsent") === "on",
      participantName: getFormValue(formData, "participantName"),
      website: getFormValue(formData, "website"),
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

function buildClassReviewPhotoAlt(
  classTitle: string | undefined,
  participantName: string,
  index: number,
) {
  return `${classTitle || "클래스"} 후기 사진 ${index + 1} - ${participantName}`;
}
