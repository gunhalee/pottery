import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { getContentEntryById } from "@/lib/content-manager/content-store";
import type {
  ContentImageLayout,
  ContentKind,
} from "@/lib/content-manager/content-model";
import { uploadMediaImage } from "@/lib/media/media-upload";
import {
  buildMediaVariantSources,
  pickMediaVariantForSurface,
} from "@/lib/media/media-variant-policy";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

const maxUploadBytes = 8 * 1024 * 1024;
const acceptedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const uploadRateLimit = {
  limit: 30,
  windowMs: 60_000,
};
const contentKinds = new Set<ContentKind>(["gallery", "news"]);
const imageLayouts = new Set<ContentImageLayout>([
  "align-left",
  "align-right",
  "default",
  "full",
  "two-column",
  "wide",
]);

export async function POST(request: Request) {
  const rateLimit = await consumeRateLimit({
    key: getClientIp(request.headers),
    limit: uploadRateLimit.limit,
    namespace: "admin-content-image-upload",
    windowMs: uploadRateLimit.windowMs,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        code: "RATE_LIMITED",
        message: "이미지 업로드 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
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
        code: "AUTH_REQUIRED",
        message: "관리자 로그인이 필요합니다.",
        nextAction: "관리자 페이지에 다시 로그인한 뒤 업로드를 다시 진행해 주세요.",
        ok: false,
      },
      { status: 401 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        code: "STORAGE_NOT_CONFIGURED",
        message: "Supabase Storage 설정이 필요합니다.",
        nextAction: "Supabase 환경변수와 media-assets 버킷 설정을 확인해 주세요.",
        ok: false,
      },
      { status: 503 },
    );
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json(
      {
        code: "INVALID_FORM_DATA",
        message: "업로드 요청을 읽지 못했습니다.",
        nextAction: "파일을 다시 선택해 업로드해 주세요.",
        ok: false,
      },
      { status: 400 },
    );
  }

  const entryId = stringValue(formData.get("entryId"));
  const kind = stringValue(formData.get("kind"));
  const layout = stringValue(formData.get("layout")) || "default";
  const file = formData.get("file");

  if (!entryId || !isContentKind(kind) || !isImageLayout(layout)) {
    return NextResponse.json(
      {
        code: "INVALID_CONTENT_UPLOAD_REQUEST",
        message: "업로드 요청 값이 올바르지 않습니다.",
        nextAction: "편집 화면을 새로고침한 뒤 다시 업로드해 주세요.",
        ok: false,
      },
      { status: 400 },
    );
  }

  const entry = await getContentEntryById(entryId);

  if (!entry || entry.kind !== kind) {
    return NextResponse.json(
      {
        code: "CONTENT_NOT_FOUND",
        message: "콘텐츠를 찾을 수 없습니다.",
        nextAction: "글이 삭제되었는지 확인한 뒤 목록에서 다시 진입해 주세요.",
        ok: false,
      },
      { status: 404 },
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        code: "IMAGE_FILE_REQUIRED",
        message: "이미지 파일이 필요합니다.",
        nextAction: "jpg, png, webp 이미지를 선택해 주세요.",
        ok: false,
      },
      { status: 400 },
    );
  }

  if (!acceptedMimeTypes.has(file.type)) {
    return NextResponse.json(
      {
        code: "UNSUPPORTED_FILE_TYPE",
        message: "jpg, png, webp 이미지만 업로드할 수 있습니다.",
        nextAction: "이미지를 jpg, png, webp 중 하나로 저장한 뒤 다시 업로드해 주세요.",
        ok: false,
      },
      { status: 400 },
    );
  }

  if (file.size > maxUploadBytes) {
    return NextResponse.json(
      {
        code: "FILE_TOO_LARGE",
        message: "이미지 파일이 8MB보다 큽니다.",
        nextAction: "이미지를 8MB 이하로 줄인 뒤 다시 업로드해 주세요.",
        ok: false,
      },
      { status: 413 },
    );
  }

  try {
    const asset = await uploadMediaImage({
      alt: buildAltText(file.name),
      buffer: Buffer.from(await file.arrayBuffer()),
      filename: file.name,
      ownerId: entry.id,
      ownerType: "content_entry",
    });
    const detailVariant = pickMediaVariantForSurface(asset, "detail");
    const variants = buildMediaVariantSources(asset);

    return NextResponse.json({
      image: {
        alt: asset.alt,
        caption: asset.caption,
        createdAt: asset.createdAt,
        height: detailVariant?.height ?? asset.height,
        id: asset.id,
        isCover: false,
        isDetail: false,
        isListImage: false,
        isReserved: asset.reserved,
        layout,
        sortOrder: entry.images.length,
        src: detailVariant?.src ?? asset.src,
        storagePath: asset.masterPath,
        updatedAt: asset.updatedAt,
        variants,
        width: detailVariant?.width ?? asset.width,
      },
      ok: true,
    });
  } catch (error) {
    console.error("[content-image-upload]", error);

    return NextResponse.json(
      {
        code: "UPLOAD_PROCESSING_FAILED",
        detail: error instanceof Error ? error.message : undefined,
        message: "이미지를 webp로 변환하거나 storage에 저장하는 중 문제가 발생했습니다.",
        nextAction:
          "같은 파일로 다시 시도하고, 반복되면 이미지를 다시 저장한 뒤 업로드해 주세요.",
        ok: false,
      },
      { status: 500 },
    );
  }
}

function buildAltText(filename: string) {
  return filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "업로드 이미지";
}

function isContentKind(value: string): value is ContentKind {
  return contentKinds.has(value as ContentKind);
}

function isImageLayout(value: string): value is ContentImageLayout {
  return imageLayouts.has(value as ContentImageLayout);
}

function stringValue(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}
