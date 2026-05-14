import { NextResponse } from "next/server";
import { z } from "zod";
import { enqueueAdminNotificationJob } from "@/lib/notifications/order-notifications";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import { validateRequestBodySize } from "@/lib/security/request-size";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

const classConsentRateLimit = {
  limit: 6,
  windowMs: 10 * 60 * 1000,
};
const maxClassConsentBodyBytes = 4 * 1024;

const classConsentSchema = z
  .object({
    classTitle: z.string().trim().max(80).optional(),
    contact: z.string().trim().max(120).optional(),
    displayName: z.string().trim().max(40).optional(),
    participantName: z.string().trim().min(1).max(40),
    siteSnsConsent: z.boolean().optional(),
    workPhotoConsent: z.boolean().optional(),
  })
  .refine((value) => value.siteSnsConsent || value.workPhotoConsent, {
    message: "선택 동의 항목을 하나 이상 선택해 주세요.",
  });

export async function POST(request: Request) {
  const rateLimit = await consumeRateLimit({
    key: getClientIp(request.headers),
    limit: classConsentRateLimit.limit,
    namespace: "class-review-consent",
    windowMs: classConsentRateLimit.windowMs,
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
    maxClassConsentBodyBytes,
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
  const parsed = classConsentSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "동의 내용을 확인해 주세요." },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "동의 저장소가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const supabase = getSupabaseAdminClient();
  const consentScope = [
    parsed.data.siteSnsConsent ? "사이트/SNS 게시" : null,
    parsed.data.workPhotoConsent ? "작업물 사진 활용" : null,
  ]
    .filter(Boolean)
    .join(", ");
  const consentText =
    "후기와 작업물 사진은 사이트 또는 SNS에 게시될 수 있으며, 얼굴이 식별되는 사진은 게시하지 않고 동의는 언제든 철회할 수 있음을 확인했습니다.";

  const { error } = await supabase.from("class_review_consents").insert({
    class_title: emptyToNull(parsed.data.classTitle),
    consent_text: consentText,
    contact: emptyToNull(parsed.data.contact),
    display_name: emptyToNull(parsed.data.displayName),
    face_photo_excluded: true,
    participant_name: parsed.data.participantName,
    site_sns_consent: Boolean(parsed.data.siteSnsConsent),
    work_photo_consent: Boolean(parsed.data.workPhotoConsent),
  });

  if (error) {
    console.error(error);

    return NextResponse.json(
      { error: "동의 접수 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }

  await enqueueAdminNotificationJob({
    payload: {
      classTitle: parsed.data.classTitle ?? null,
      consentScope,
      displayName: parsed.data.displayName ?? null,
      participantName: parsed.data.participantName,
    },
    template: "admin_class_review_consent_received",
  });

  return NextResponse.json(
    {
      message: "선택 동의가 접수되었습니다.",
    },
    {
      headers: rateLimitHeaders(rateLimit),
    },
  );
}

function emptyToNull(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
