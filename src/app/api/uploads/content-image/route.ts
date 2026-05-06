import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { getContentEntryById } from "@/lib/content-manager/content-store";
import type {
  ContentImageLayout,
  ContentKind,
} from "@/lib/content-manager/content-model";
import { uploadMediaImage } from "@/lib/media/media-upload";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

const maxUploadBytes = 8 * 1024 * 1024;
const acceptedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
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

  const formData = await request.formData();
  const entryId = stringValue(formData.get("entryId"));
  const kind = stringValue(formData.get("kind"));
  const layout = stringValue(formData.get("layout")) || "default";
  const file = formData.get("file");

  if (!entryId || !isContentKind(kind) || !isImageLayout(layout)) {
    return NextResponse.json(
      {
        message: "업로드 요청 값이 올바르지 않습니다.",
        ok: false,
      },
      { status: 400 },
    );
  }

  const entry = await getContentEntryById(entryId);

  if (!entry || entry.kind !== kind) {
    return NextResponse.json(
      {
        message: "콘텐츠를 찾을 수 없습니다.",
        ok: false,
      },
      { status: 404 },
    );
  }

  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        message: "이미지 파일이 필요합니다.",
        ok: false,
      },
      { status: 400 },
    );
  }

  if (!acceptedMimeTypes.has(file.type) || file.size > maxUploadBytes) {
    return NextResponse.json(
      {
        message: "jpg, png, webp 이미지만 8MB 이하로 업로드할 수 있습니다.",
        ok: false,
      },
      { status: 400 },
    );
  }

  try {
    const asset = await uploadMediaImage({
      alt: buildAltText(file.name),
      buffer: Buffer.from(await file.arrayBuffer()),
      filename: file.name,
    });
    const detailVariant =
      asset.variants.find((variant) => variant.variant === "detail") ??
      asset.variants.find((variant) => variant.variant === "master") ??
      null;

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
        width: detailVariant?.width ?? asset.width,
      },
      ok: true,
    });
  } catch (error) {
    throw error;
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
