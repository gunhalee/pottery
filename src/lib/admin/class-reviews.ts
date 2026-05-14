import "server-only";

import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import {
  readClassReviewImagesByReviewIds,
  type ClassReviewImage,
} from "@/lib/shop/class-reviews";

export type AdminClassReviewStatus = "hidden" | "pending" | "published";

export type AdminClassReviewEntry = {
  body: string;
  classSessionId: string | null;
  classSessionTitle: string | null;
  classTitle: string | null;
  contact: string | null;
  consentText: string | null;
  createdAt: string;
  displayName: string | null;
  id: string;
  images: ClassReviewImage[];
  marketingConsent: boolean;
  marketingConsentAt: string | null;
  marketingConsentScope: string | null;
  participantName: string;
  revokedAt: string | null;
  status: AdminClassReviewStatus;
  updatedAt: string;
};

type ClassReviewRow = {
  body: string;
  class_session_id: string | null;
  class_title: string | null;
  class_sessions?: {
    title?: string | null;
  } | null;
  consent_text: string | null;
  contact: string | null;
  created_at: string;
  display_name: string | null;
  id: string;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  marketing_consent_scope: string | null;
  participant_name: string;
  revoked_at: string | null;
  status: AdminClassReviewStatus;
  updated_at: string;
};

export async function getAdminClassReviews({
  status,
}: {
  status?: AdminClassReviewStatus | "all";
} = {}) {
  if (!isSupabaseConfigured()) {
    return [] satisfies AdminClassReviewEntry[];
  }

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("class_reviews")
    .select(
      [
        "id",
        "participant_name",
        "contact",
        "class_session_id",
        "class_title",
        "display_name",
        "body",
        "status",
        "marketing_consent",
        "marketing_consent_at",
        "marketing_consent_scope",
        "consent_text",
        "revoked_at",
        "created_at",
        "updated_at",
        "class_sessions (title)",
      ].join(", "),
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Class review query failed: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as ClassReviewRow[];
  const imageMap = await readClassReviewImagesByReviewIds(
    rows.map((row) => row.id),
  );

  return rows.map((row) => ({
    body: row.body,
    classSessionId: row.class_session_id,
    classSessionTitle: row.class_sessions?.title ?? null,
    classTitle: row.class_title,
    consentText: row.consent_text,
    contact: row.contact,
    createdAt: row.created_at,
    displayName: row.display_name,
    id: row.id,
    images: imageMap.get(row.id) ?? [],
    marketingConsent: row.marketing_consent,
    marketingConsentAt: row.marketing_consent_at,
    marketingConsentScope: row.marketing_consent_scope,
    participantName: row.participant_name,
    revokedAt: row.revoked_at,
    status: row.status,
    updatedAt: row.updated_at,
  }));
}

export async function updateAdminClassReviewStatus({
  reviewId,
  status,
}: {
  reviewId: string;
  status: AdminClassReviewStatus;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase class review storage is not configured.");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("class_reviews")
    .update({ status })
    .eq("id", reviewId)
    .select("id, status")
    .single();

  if (error) {
    throw new Error(`Class review status update failed: ${error.message}`);
  }

  return data as { id: string; status: AdminClassReviewStatus };
}

export async function updateAdminClassReviewSession({
  classSessionId,
  reviewId,
}: {
  classSessionId: string | null;
  reviewId: string;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase class review storage is not configured.");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("class_reviews")
    .update({ class_session_id: classSessionId })
    .eq("id", reviewId)
    .select("id, class_session_id")
    .single();

  if (error) {
    throw new Error(`Class review session update failed: ${error.message}`);
  }

  return data as { class_session_id: string | null; id: string };
}

export async function revokeAdminClassReviewConsent(reviewId: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase class review storage is not configured.");
  }

  const revokedAt = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("class_reviews")
    .update({ revoked_at: revokedAt })
    .eq("id", reviewId);

  if (error) {
    throw new Error(`Class review consent revoke failed: ${error.message}`);
  }

  await supabase
    .from("class_review_consents")
    .update({ revoked_at: revokedAt })
    .eq("class_review_id", reviewId);

  return { reviewId, revokedAt };
}
