import "server-only";

import {
  readContentEntries,
  getContentAdminPath,
} from "@/lib/content-manager/content-store";
import { mediaAssetBucket } from "@/lib/media/media-store";
import { walkLexicalNodes } from "@/lib/content-manager/rich-text-utils";
import { readProducts } from "@/lib/shop/product-store";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { inspectOrphanUploads } from "@/lib/uploads/orphan-cleanup";

export type UploadCleanupLog = {
  bucket: string;
  createdAt: string;
  dryRun: boolean;
  errorMessage: string | null;
  id: number;
  reason: string;
  storagePath: string;
  success: boolean;
};

export type MediaReferenceItem = {
  bucket: string;
  createdAt?: string;
  ownerHref: string;
  ownerTitle: string;
  ownerType: "gallery" | "news" | "product";
  role: string;
  status: "attached" | "body-unlinked" | "referenced";
  storagePath: string;
};

export type ProductContentLinkItem = {
  contentHref: string;
  contentKind: "gallery" | "news";
  contentTitle: string;
  productSlug: string;
  productTitle: string;
  status: "linked" | "missing-product";
};

export type OperationsDashboardData = {
  cleanupLogs: UploadCleanupLog[];
  cleanupPreview: Awaited<ReturnType<typeof inspectOrphanUploads>>;
  mediaReferences: MediaReferenceItem[];
  productContentLinks: ProductContentLinkItem[];
  stats: {
    bodyUnlinkedImages: number;
    cleanupFailures: number;
    cleanupPreviewCandidates: number;
    contentImages: number;
    productContentLinks: number;
    productImages: number;
  };
};

type CleanupLogRow = {
  bucket: string;
  created_at: string;
  dry_run: boolean;
  error_message: string | null;
  id: number;
  reason: string;
  storage_path: string;
  success: boolean;
};

export async function getOperationsDashboardData(): Promise<OperationsDashboardData> {
  const [cleanupLogs, cleanupPreview, products, entries] = await Promise.all([
    readUploadCleanupLogs(),
    inspectOrphanUploads({ maxCandidates: 30, minAgeHours: 48 }),
    readProducts(),
    readContentEntries(),
  ]);
  const productBySlug = new Map(products.map((product) => [product.slug, product]));
  const mediaReferences: MediaReferenceItem[] = [];
  const productContentLinks: ProductContentLinkItem[] = [];

  for (const product of products) {
    for (const [index, image] of product.images.entries()) {
      if (!image.storagePath) {
        continue;
      }

      const roles = [
        image.isPrimary ? "대표" : null,
        image.isListImage ? "목록" : null,
        image.isDetail ? "상세 갤러리" : null,
        image.isDescription ? "설명 삽입" : null,
      ].filter((role): role is string => Boolean(role));

      mediaReferences.push({
        bucket: mediaAssetBucket,
        ownerHref: `/admin/products/${product.id}`,
        ownerTitle: product.titleKo,
        ownerType: "product",
        role: roles.join(" / ") || (index === 0 ? "첨부" : "상세 이미지"),
        status: "referenced",
        storagePath: image.storagePath,
      });
    }
  }

  for (const entry of entries) {
    const imageIdsInBody = new Set(
      walkLexicalNodes(entry.body)
        .filter((node) => node.type === "content-image")
        .map((node) => node.id)
        .filter((id): id is string => typeof id === "string"),
    );

    for (const image of entry.images) {
      const roles = [
        image.isCover ? "대표" : null,
        image.isListImage ? "목록" : null,
        image.isDetail ? "상세 하단" : null,
        image.isReserved ? "보관" : null,
        imageIdsInBody.has(image.id) ? "본문" : null,
      ].filter((role): role is string => Boolean(role));

      mediaReferences.push({
        bucket: mediaAssetBucket,
        createdAt: image.createdAt,
        ownerHref: `${getContentAdminPath(entry.kind)}/${entry.id}`,
        ownerTitle: entry.title,
        ownerType: entry.kind,
        role: roles.join(" / ") || "첨부만 됨",
        status:
          roles.length > 0
            ? "referenced"
            : entry.status === "draft"
              ? "attached"
              : "body-unlinked",
        storagePath: image.storagePath,
      });
    }

    if (entry.relatedProductSlug) {
      const product = productBySlug.get(entry.relatedProductSlug);

      productContentLinks.push({
        contentHref: `${getContentAdminPath(entry.kind)}/${entry.id}`,
        contentKind: entry.kind,
        contentTitle: entry.title,
        productSlug: entry.relatedProductSlug,
        productTitle: product?.titleKo ?? "연결 상품 없음",
        status: product ? "linked" : "missing-product",
      });
    }
  }

  const productImages = mediaReferences.filter(
    (item) => item.ownerType === "product",
  ).length;
  const contentImages = mediaReferences.length - productImages;

  return {
    cleanupLogs,
    cleanupPreview,
    mediaReferences: mediaReferences.sort((a, b) =>
      a.ownerTitle.localeCompare(b.ownerTitle, "ko-KR"),
    ),
    productContentLinks,
    stats: {
      bodyUnlinkedImages: mediaReferences.filter(
        (item) => item.status === "body-unlinked",
      ).length,
      cleanupFailures: cleanupLogs.filter((log) => !log.success).length,
      cleanupPreviewCandidates: cleanupPreview.candidates.length,
      contentImages,
      productContentLinks: productContentLinks.length,
      productImages,
    },
  };
}

async function readUploadCleanupLogs(limit = 40): Promise<UploadCleanupLog[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("upload_cleanup_logs")
    .select(
      "id, bucket, storage_path, reason, dry_run, success, error_message, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingCleanupLogTableError(error)) {
      return [];
    }

    throw new Error(`Failed to read upload cleanup logs: ${error.message}`);
  }

  return ((data ?? []) as CleanupLogRow[]).map((row) => ({
    bucket: row.bucket,
    createdAt: row.created_at,
    dryRun: row.dry_run,
    errorMessage: row.error_message,
    id: row.id,
    reason: row.reason,
    storagePath: row.storage_path,
    success: row.success,
  }));
}

function isMissingCleanupLogTableError(error: { message?: string }) {
  const message = error.message ?? "";
  return (
    message.includes("upload_cleanup_logs") &&
    (message.includes("schema cache") || message.includes("does not exist"))
  );
}
