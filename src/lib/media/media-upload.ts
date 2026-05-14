import "server-only";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  createMediaAsset,
  mediaAssetBucket,
} from "@/lib/media/media-store";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import {
  createStorageUploadIntent,
  markStorageUploadIntentClaimed,
  markStorageUploadIntentCleaned,
  markStorageUploadIntentCleanupPending,
  markStorageUploadIntentFailed,
  markStorageUploadIntentUploaded,
  markStorageUploadIntentUploading,
  setStorageUploadIntentPaths,
} from "@/lib/uploads/storage-upload-intent";
import type { MediaAsset, MediaOwnerType } from "./media-model";

export type UploadedVariant = {
  data: Buffer;
  height: number;
  storagePath: string;
  variant: "detail" | "list" | "master" | "thumbnail";
  width: number;
};

export type MediaImageUploadInput = {
  alt: string;
  buffer: Buffer;
  filename: string;
  ownerId?: string;
  ownerType?: MediaOwnerType;
  reserved?: boolean;
};

let ensureMediaAssetBucketPromise: Promise<void> | null = null;
const maxInputPixels = 40_000_000;

export async function uploadMediaImage(
  input: MediaImageUploadInput,
): Promise<MediaAsset> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase Storage 설정이 필요합니다.");
  }

  const assetId = randomUUID();
  const variants = await buildImageVariants(input.buffer, assetId);
  const supabase = getSupabaseAdminClient();

  await ensureMediaAssetBucket();

  const uploadedPaths: string[] = [];
  const uploadIntent = await createStorageUploadIntent({
    assetId,
    bucket: mediaAssetBucket,
    metadata: {
      filename: input.filename,
      variantCount: variants.length,
    },
    ownerId: input.ownerId,
    ownerType: input.ownerType,
  });

  try {
    await markStorageUploadIntentUploading(uploadIntent);

    for (const variant of variants) {
      const { error } = await supabase.storage
        .from(mediaAssetBucket)
        .upload(variant.storagePath, variant.data, {
          cacheControl: "31536000",
          contentType: "image/webp",
          upsert: false,
        });

      if (error) {
        throw new Error(error.message);
      }

      uploadedPaths.push(variant.storagePath);
      await setStorageUploadIntentPaths(uploadIntent, uploadedPaths);
    }

    await markStorageUploadIntentUploaded(uploadIntent, uploadedPaths);

    const master = variants.find((variant) => variant.variant === "master");

    if (!master) {
      throw new Error("Master image variant was not generated.");
    }

    const getPublicUrl = (storagePath: string) =>
      supabase.storage.from(mediaAssetBucket).getPublicUrl(storagePath).data
        .publicUrl;

    const asset = await createMediaAsset({
      alt: input.alt || buildAltText(input.filename),
      height: master.height,
      id: assetId,
      masterPath: master.storagePath,
      reserved: input.reserved,
      sizeBytes: master.data.length,
      src: getPublicUrl(master.storagePath),
      variants: variants.map((variant) => ({
        height: variant.height,
        sizeBytes: variant.data.length,
        src: getPublicUrl(variant.storagePath),
        storagePath: variant.storagePath,
        variant: variant.variant,
        width: variant.width,
      })),
      width: master.width,
    });
    await markStorageUploadIntentClaimed(uploadIntent, uploadedPaths);

    return asset;
  } catch (error) {
    if (uploadedPaths.length > 0) {
      const { error: cleanupError } = await supabase.storage
        .from(mediaAssetBucket)
        .remove(uploadedPaths);

      if (cleanupError) {
        await markStorageUploadIntentCleanupPending(
          uploadIntent,
          new Error(
            `${getErrorMessage(error)}; storage cleanup failed: ${cleanupError.message}`,
          ),
          uploadedPaths,
        );
      } else {
        await markStorageUploadIntentCleaned(
          uploadIntent,
          error,
          uploadedPaths,
        );
      }
    } else {
      await markStorageUploadIntentFailed(uploadIntent, error);
    }

    throw error;
  }
}

export async function ensureMediaAssetBucket() {
  ensureMediaAssetBucketPromise ??= ensureMediaAssetBucketExists().catch(
    (error) => {
      ensureMediaAssetBucketPromise = null;
      throw error;
    },
  );

  return ensureMediaAssetBucketPromise;
}

async function ensureMediaAssetBucketExists() {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage.getBucket(mediaAssetBucket);

  if (!error) {
    return;
  }

  if (!isStorageNotFoundError(error)) {
    throw new Error(`Supabase Storage bucket 확인 실패: ${error.message}`);
  }

  const { error: createError } = await supabase.storage.createBucket(
    mediaAssetBucket,
    {
      allowedMimeTypes: ["image/webp"],
      fileSizeLimit: 8 * 1024 * 1024,
      public: true,
    },
  );

  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(`Supabase Storage bucket 생성 실패: ${createError.message}`);
  }
}

export async function buildImageVariants(buffer: Buffer, assetId: string) {
  const normalized = sharp(buffer, { limitInputPixels: maxInputPixels }).rotate();
  const variantInputs = [
    {
      fit: "inside" as const,
      size: 2400,
      variant: "master" as const,
    },
    {
      fit: "inside" as const,
      size: 1800,
      variant: "detail" as const,
    },
    {
      fit: "cover" as const,
      size: 900,
      variant: "list" as const,
    },
    {
      fit: "cover" as const,
      size: 320,
      variant: "thumbnail" as const,
    },
  ];
  const variants: UploadedVariant[] = [];

  for (const input of variantInputs) {
    const image = await normalized
      .clone()
      .resize({
        fit: input.fit,
        height: input.size,
        withoutEnlargement: input.fit === "inside",
        width: input.size,
      })
      .webp({ quality: input.variant === "thumbnail" ? 76 : 84 })
      .toBuffer({ resolveWithObject: true });

    variants.push({
      data: image.data,
      height: image.info.height,
      storagePath: `assets/${assetId}/${input.variant}.webp`,
      variant: input.variant,
      width: image.info.width,
    });
  }

  return variants;
}

function isStorageNotFoundError(error: { message?: string; statusCode?: string }) {
  return error.statusCode === "404" || /not found/i.test(error.message ?? "");
}

function buildAltText(filename: string) {
  return (
    filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() ||
    "업로드 이미지"
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown media upload error.";
}
