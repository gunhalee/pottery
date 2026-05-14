import "server-only";

import {
  buildMediaVariantSources,
  pickMediaVariantForSurface,
} from "@/lib/media/media-variant-policy";
import { readMediaAssetsByIds } from "@/lib/media/media-store";
import type { MediaAsset, MediaVariantSourceMap } from "@/lib/media/media-model";
import { getClassSessionById } from "@/lib/shop/class-sessions";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const classReviewMarketingConsentScope = "site_sns_class_review";
export const classReviewMarketingConsentText =
  "작성한 클래스 후기와 작업물 사진을 콩새와 도자기공방의 사이트, SNS, 홍보 콘텐츠에 활용하는 데 동의합니다. 동의하지 않아도 후기 작성은 가능합니다.";

export type ClassReviewImage = {
  alt: string;
  assetId: string;
  height: number;
  id: string;
  src: string;
  sortOrder: number;
  variants: MediaVariantSourceMap;
  width: number;
};

export type ClassReviewEntry = {
  body: string;
  classSessionId: string | null;
  classTitle: string | null;
  createdAt: string;
  displayName: string;
  id: string;
  images: ClassReviewImage[];
};

export type ClassReviewInput = {
  body: string;
  classSessionId?: string | null;
  classTitle?: string | null;
  contact?: string | null;
  marketingConsent?: boolean;
  participantName: string;
};

type ClassReviewRow = {
  body: string;
  class_session_id: string | null;
  class_title: string | null;
  created_at: string;
  display_name: string | null;
  id: string;
  participant_name: string;
};

type ClassReviewImageRow = {
  class_review_id: string;
  id: string;
  media_asset_id: string;
  sort_order: number;
};

const classReviewColumns =
  "id, participant_name, display_name, class_session_id, class_title, body, created_at";

export async function getPublishedClassReviews() {
  if (!isSupabaseConfigured()) {
    return [] satisfies ClassReviewEntry[];
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("class_reviews")
    .select(classReviewColumns)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Class review query failed: ${error.message}`);
  }

  const rows = (data ?? []) as ClassReviewRow[];
  const imageMap = await readClassReviewImagesByReviewIds(
    rows.map((row) => row.id),
  );

  return rows.map((row) => fromClassReviewRow(row, imageMap));
}

export async function createClassReview(input: ClassReviewInput) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase class review storage is not configured.");
  }

  const now = new Date().toISOString();
  const marketingConsent = Boolean(input.marketingConsent);
  const supabase = getSupabaseAdminClient();
  const classSession = input.classSessionId
    ? await getClassSessionById(input.classSessionId)
    : null;
  const classTitle = input.classTitle || classSession?.title || null;
  const { data, error } = await supabase
    .from("class_reviews")
    .insert({
      body: input.body,
      class_session_id: classSession?.id ?? null,
      class_title: classTitle,
      consent_text: marketingConsent ? classReviewMarketingConsentText : null,
      contact: input.contact || null,
      display_name: input.participantName,
      marketing_consent: marketingConsent,
      marketing_consent_at: marketingConsent ? now : null,
      marketing_consent_scope: marketingConsent
        ? classReviewMarketingConsentScope
        : null,
      participant_name: input.participantName,
      status: "pending",
    })
    .select(classReviewColumns)
    .single();

  if (error) {
    throw new Error(`Class review insert failed: ${error.message}`);
  }

  const review = fromClassReviewRow(data as ClassReviewRow);

  if (marketingConsent) {
    await supabase.from("class_review_consents").insert({
      class_review_id: review.id,
      class_session_id: classSession?.id ?? null,
      class_title: classTitle,
      consent_text: classReviewMarketingConsentText,
      contact: input.contact || null,
      display_name: input.participantName,
      participant_name: input.participantName,
      scope: classReviewMarketingConsentScope,
      site_sns_consent: true,
      work_photo_consent: true,
    });
  }

  return review;
}

export async function attachClassReviewImages({
  assets,
  reviewId,
}: {
  assets: MediaAsset[];
  reviewId: string;
}) {
  if (!isSupabaseConfigured() || assets.length === 0) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("class_review_images").insert(
    assets.map((asset, index) => ({
      class_review_id: reviewId,
      media_asset_id: asset.id,
      sort_order: index,
    })),
  );

  if (error) {
    throw new Error(`Class review image insert failed: ${error.message}`);
  }
}

export async function readClassReviewImagesByReviewIds(reviewIds: string[]) {
  const imageMap = new Map<string, ClassReviewImage[]>();

  if (!isSupabaseConfigured() || reviewIds.length === 0) {
    return imageMap;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("class_review_images")
    .select("id, class_review_id, media_asset_id, sort_order")
    .in("class_review_id", [...new Set(reviewIds)])
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Class review image query failed: ${error.message}`);
  }

  const rows = (data ?? []) as ClassReviewImageRow[];
  const assets = await readMediaAssetsByIds(rows.map((row) => row.media_asset_id));
  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));

  for (const row of rows) {
    const asset = assetMap.get(row.media_asset_id);

    if (!asset) {
      continue;
    }

    const image = fromClassReviewImageRow(row, asset);

    if (!image) {
      continue;
    }

    const images = imageMap.get(row.class_review_id) ?? [];
    images.push(image);
    imageMap.set(row.class_review_id, images);
  }

  return imageMap;
}

function fromClassReviewRow(
  row: ClassReviewRow,
  imageMap = new Map<string, ClassReviewImage[]>(),
): ClassReviewEntry {
  return {
    body: row.body,
    classSessionId: row.class_session_id,
    classTitle: row.class_title,
    createdAt: row.created_at,
    displayName: row.display_name ?? row.participant_name,
    id: row.id,
    images: imageMap.get(row.id) ?? [],
  };
}

function fromClassReviewImageRow(
  row: ClassReviewImageRow,
  asset: MediaAsset,
): ClassReviewImage | null {
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
