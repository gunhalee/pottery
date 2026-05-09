import "server-only";

import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export type ProductFeedbackEntry = {
  authorName: string;
  body: string;
  createdAt: string;
  id: string;
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
      product_id: input.productId,
      rating: input.rating,
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

  return {
    count: count ?? data?.length ?? 0,
    entries: ((data ?? []) as ProductFeedbackRow[]).map(fromProductFeedbackRow),
  };
}

function fromProductFeedbackRow(row: ProductFeedbackRow): ProductFeedbackEntry {
  return {
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
    id: row.id,
    rating: row.rating,
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
