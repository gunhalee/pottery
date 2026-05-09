import "server-only";

import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export type ProductFeedbackKind = "inquiry" | "review";
export type ProductFeedbackStatus = "hidden" | "pending" | "published";

export type ProductFeedbackEntry = {
  authorName: string;
  body: string;
  contact: string | null;
  createdAt: string;
  id: string;
  isPrivate: boolean;
  kind: ProductFeedbackKind;
  productId: string;
  rating: number | null;
  status: ProductFeedbackStatus;
};

export type ProductFeedbackSummary = {
  inquiries: ProductFeedbackEntry[];
  inquiryCount: number;
  reviewCount: number;
  reviews: ProductFeedbackEntry[];
};

export type ProductFeedbackInput = {
  authorName: string;
  body: string;
  contact?: string | null;
  isPrivate?: boolean;
  kind: ProductFeedbackKind;
  productId: string;
  rating?: number | null;
};

type ProductFeedbackRow = {
  author_name: string;
  body: string;
  contact: string | null;
  created_at: string;
  id: string;
  is_private: boolean;
  kind: ProductFeedbackKind;
  product_id: string;
  rating: number | null;
  status: ProductFeedbackStatus;
};

const feedbackColumns =
  "id, product_id, kind, author_name, contact, body, rating, is_private, status, created_at";

export async function getProductFeedbackSummary(
  productId: string,
): Promise<ProductFeedbackSummary> {
  if (!isSupabaseConfigured()) {
    return emptyProductFeedbackSummary();
  }

  const [reviews, inquiries] = await Promise.all([
    readPublishedProductFeedback(productId, "review"),
    readPublishedProductFeedback(productId, "inquiry"),
  ]);

  return {
    inquiries: inquiries.entries,
    inquiryCount: inquiries.count,
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
      is_private: input.kind === "inquiry",
      kind: input.kind,
      product_id: input.productId,
      rating: input.kind === "review" ? input.rating : null,
      status: "pending",
    })
    .select(feedbackColumns)
    .single();

  if (error) {
    throw new Error(`Supabase product feedback insert failed: ${error.message}`);
  }

  return fromProductFeedbackRow(data as ProductFeedbackRow);
}

function emptyProductFeedbackSummary(): ProductFeedbackSummary {
  return {
    inquiries: [],
    inquiryCount: 0,
    reviewCount: 0,
    reviews: [],
  };
}

async function readPublishedProductFeedback(
  productId: string,
  kind: ProductFeedbackKind,
) {
  const supabase = getSupabaseAdminClient();
  const { count, data, error } = await supabase
    .from("shop_product_feedback")
    .select(feedbackColumns, { count: "exact" })
    .eq("product_id", productId)
    .eq("kind", kind)
    .eq("status", "published")
    .eq("is_private", false)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    if (isMissingFeedbackStorageError(error)) {
      return { count: 0, entries: [] };
    }

    throw new Error(`Supabase product feedback query failed: ${error.message}`);
  }

  return {
    count: count ?? data?.length ?? 0,
    entries: ((data ?? []) as ProductFeedbackRow[]).map(fromProductFeedbackRow),
  };
}

function fromProductFeedbackRow(row: ProductFeedbackRow): ProductFeedbackEntry {
  return {
    authorName: row.author_name,
    body: row.body,
    contact: row.contact,
    createdAt: row.created_at,
    id: row.id,
    isPrivate: row.is_private,
    kind: row.kind,
    productId: row.product_id,
    rating: row.rating,
    status: row.status,
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
