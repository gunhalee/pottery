import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { getProductById } from "@/lib/shop";
import { uploadMediaImage } from "@/lib/media/media-upload";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

const maxUploadBytes = 8 * 1024 * 1024;
const acceptedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

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
  const productId = stringValue(formData.get("productId"));
  const file = formData.get("file");

  if (!productId) {
    return NextResponse.json(
      {
        message: "상품 ID가 필요합니다.",
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

  const asset = await uploadMediaImage({
    alt: buildAltText(file.name, product.titleKo),
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
      height: detailVariant?.height ?? asset.height,
      id: asset.id,
      isDetail: true,
      isListImage: false,
      isPrimary: false,
      src: detailVariant?.src ?? asset.src,
      storagePath: asset.masterPath,
      width: detailVariant?.width ?? asset.width,
    },
    ok: true,
  });
}

function buildAltText(filename: string, fallbackTitle: string) {
  return (
    filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() ||
    `${fallbackTitle} 이미지`
  );
}

function stringValue(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}
