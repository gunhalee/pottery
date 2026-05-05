import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  addContentImage,
  contentImageBucket,
} from "@/lib/content-manager/content-store";
import type {
  ContentImageLayout,
  ContentKind,
} from "@/lib/content-manager/content-model";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

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

  const buffer = Buffer.from(await file.arrayBuffer());
  const converted = await sharp(buffer)
    .rotate()
    .resize({
      fit: "inside",
      height: 1800,
      withoutEnlargement: true,
      width: 1800,
    })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const supabase = getSupabaseAdminClient();
  await ensureContentImageBucket();

  const storagePath = `${kind}/${entryId}/${randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from(contentImageBucket)
    .upload(storagePath, converted.data, {
      cacheControl: "31536000",
      contentType: "image/webp",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      {
        message: uploadError.message,
        ok: false,
      },
      { status: 500 },
    );
  }

  const { data } = supabase.storage
    .from(contentImageBucket)
    .getPublicUrl(storagePath);

  try {
    const image = await addContentImage({
      alt: buildAltText(file.name),
      entryId,
      height: converted.info.height,
      layout,
      src: data.publicUrl,
      storagePath,
      width: converted.info.width,
    });

    return NextResponse.json({
      image,
      ok: true,
    });
  } catch (error) {
    await supabase.storage.from(contentImageBucket).remove([storagePath]);
    throw error;
  }
}

async function ensureContentImageBucket() {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage.getBucket(contentImageBucket);

  if (!error) {
    return;
  }

  if (!isStorageNotFoundError(error)) {
    throw new Error(`Supabase Storage bucket 확인 실패: ${error.message}`);
  }

  const { error: createError } = await supabase.storage.createBucket(
    contentImageBucket,
    {
      allowedMimeTypes: ["image/webp"],
      fileSizeLimit: maxUploadBytes,
      public: true,
    },
  );

  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(`Supabase Storage bucket 생성 실패: ${createError.message}`);
  }
}

function isStorageNotFoundError(error: { message?: string; statusCode?: string }) {
  return error.statusCode === "404" || /not found/i.test(error.message ?? "");
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
