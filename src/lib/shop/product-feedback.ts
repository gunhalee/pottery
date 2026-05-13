import "server-only";

import {
  buildMediaVariantSources,
  pickMediaVariantForSurface,
} from "@/lib/media/media-variant-policy";
import { readMediaAssetsByIds } from "@/lib/media/media-store";
import type { MediaAsset, MediaVariantSourceMap } from "@/lib/media/media-model";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export type ProductFeedbackImage = {
  alt: string;
  assetId: string;
  height: number;
  id: string;
  src: string;
  sortOrder: number;
  variants: MediaVariantSourceMap;
  width: number;
};

export type ProductFeedbackEntry = {
  authorName: string;
  body: string;
  createdAt: string;
  id: string;
  images: ProductFeedbackImage[];
  rating: number;
};

export type ProductFeedbackSummary = {
  reviewCount: number;
  reviews: ProductFeedbackEntry[];
};

export type ProductFeedbackInput = {
  authorName: string;
  body: string;
  contact?: string | null;
  marketingConsent?: boolean;
  productId: string;
  rating: number;
};

type ProductFeedbackRow = {
  author_name: string;
  body: string;
  created_at: string;
  id: string;
  rating: number;
};

type ProductFeedbackImageRow = {
  feedback_id: string;
  id: string;
  media_asset_id: string;
  sort_order: number;
};

const feedbackColumns = "id, author_name, body, rating, created_at";

export async function getProductFeedbackSummary(
  productId: string,
): Promise<ProductFeedbackSummary> {
  if (!isSupabaseConfigured()) {
    return emptyProductFeedbackSummary();
  }

  const reviews = await readPublishedProductFeedback(productId);

  return {
    reviewCount: reviews.count,
    reviews: reviews.entries,
  };
}

export async function createProductFeedback(input: ProductFeedbackInput) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase feedback storage is not configured.");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_product_feedback")
    .insert({
      author_name: input.authorName,
      body: input.body,
      contact: input.contact || null,
      marketing_consent: Boolean(input.marketingConsent),
      marketing_consent_at: input.marketingConsent
        ? new Date().toISOString()
        : null,
      marketing_consent_scope: input.marketingConsent
        ? "site_sns_promotion"
        : null,
      product_id: input.productId,
      rating: input.rating,
      status: "pending",
    })
    .select(feedbackColumns)
    .single();

  if (error) {
    throw new Error(`Supabase product feedback insert failed: ${error.message}`);
  }

  const feedback = fromProductFeedbackRow(data as ProductFeedbackRow);

  if (input.marketingConsent) {
    await supabase.from("shop_review_marketing_consents").insert({
      consent_text:
        "작성한 구매평과 사진을 콩새와 도자기공방의 SNS, 홍보 콘텐츠에 활용하는 데 동의합니다.",
      feedback_id: feedback.id,
      scope: "site_sns_promotion",
    });
  }

  return feedback;
}

export async function attachProductFeedbackImages({
  assets,
  feedbackId,
}: {
  assets: MediaAsset[];
  feedbackId: string;
}) {
  if (!isSupabaseConfigured() || assets.length === 0) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("shop_product_feedback_images").insert(
    assets.map((asset, index) => ({
      feedback_id: feedbackId,
      media_asset_id: asset.id,
      sort_order: index,
    })),
  );

  if (error) {
    throw new Error(`Supabase product feedback image insert failed: ${error.message}`);
  }
}

export async function readFeedbackImagesByFeedbackIds(feedbackIds: string[]) {
  const imageMap = new Map<string, ProductFeedbackImage[]>();

  if (!isSupabaseConfigured() || feedbackIds.length === 0) {
    return imageMap;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_product_feedback_images")
    .select("id, feedback_id, media_asset_id, sort_order")
    .in("feedback_id", [...new Set(feedbackIds)])
    .order("sort_order", { ascending: true });

  if (error) {
    if (isMissingFeedbackStorageError(error)) {
      return imageMap;
    }

    throw new Error(`Supabase product feedback images query failed: ${error.message}`);
  }

  const rows = (data ?? []) as ProductFeedbackImageRow[];
  const assets = await readMediaAssetsByIds(rows.map((row) => row.media_asset_id));
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));

  for (const row of rows) {
    const asset = assetMap.get(row.media_asset_id);

    if (!asset) {
      continue;
    }

    const image = fromFeedbackImageRow(row, asset);

    if (!image) {
      continue;
    }

    const images = imageMap.get(row.feedback_id) ?? [];
    images.push(image);
    imageMap.set(row.feedback_id, images);
  }

  return imageMap;
}

function emptyProductFeedbackSummary(): ProductFeedbackSummary {
  return {
    reviewCount: 0,
    reviews: [],
  };
}

async function readPublishedProductFeedback(productId: string) {
  const supabase = getSupabaseAdminClient();
  const { count, data, error } = await supabase
    .from("shop_product_feedback")
    .select(feedbackColumns, { count: "exact" })
    .eq("product_id", productId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    if (isMissingFeedbackStorageError(error)) {
      return { count: 0, entries: [] };
    }

    throw new Error(`Supabase product feedback query failed: ${error.message}`);
  }

  const rows = (data ?? []) as ProductFeedbackRow[];
  const imageMap = await readFeedbackImagesByFeedbackIds(rows.map((row) => row.id));

  return {
    count: count ?? rows.length,
    entries: rows.map((row) => fromProductFeedbackRow(row, imageMap)),
  };
}

function fromProductFeedbackRow(
  row: ProductFeedbackRow,
  imageMap = new Map<string, ProductFeedbackImage[]>(),
): ProductFeedbackEntry {
  return {
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
    id: row.id,
    images: imageMap.get(row.id) ?? [],
    rating: row.rating,
  };
}

function fromFeedbackImageRow(
  row: ProductFeedbackImageRow,
  asset: MediaAsset,
): ProductFeedbackImage | null {
  const listVariant = pickMediaVariantForSurface(asset, "list");

  if (!listVariant) {
    return null;
  }

  return {
    alt: asset.alt,
    assetId: asset.id,
    height: listVariant.height,
    id: row.id,
    sortOrder: row.sort_order,
    src: listVariant.src,
    variants: buildMediaVariantSources(asset),
    width: listVariant.width,
  };
}

function isMissingFeedbackStorageError(error: { code?: string; message?: string }) {
  const message = error.message ?? "";

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (message.includes("shop_product_feedback") &&
      (message.includes("schema cache") ||
        message.includes("does not exist") ||
        message.includes("relation")))
  );
}
