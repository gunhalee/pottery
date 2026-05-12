import "server-only";

import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import {
  readFeedbackImagesByFeedbackIds,
  type ProductFeedbackImage,
} from "@/lib/shop/product-feedback";

export type AdminProductFeedbackStatus = "hidden" | "pending" | "published";

export type AdminProductFeedbackEntry = {
  authorName: string;
  body: string;
  contact: string | null;
  createdAt: string;
  id: string;
  images: ProductFeedbackImage[];
  productId: string;
  productSlug: string | null;
  productTitle: string | null;
  rating: number;
  status: AdminProductFeedbackStatus;
  updatedAt: string;
};

type ProductFeedbackRow = {
  author_name: string;
  body: string;
  contact: string | null;
  created_at: string;
  id: string;
  product_id: string;
  rating: number;
  shop_products?: {
    slug?: string | null;
    title_ko?: string | null;
  } | null;
  status: AdminProductFeedbackStatus;
  updated_at: string;
};

export async function getAdminProductFeedback({
  status,
}: {
  status?: AdminProductFeedbackStatus | "all";
} = {}) {
  if (!isSupabaseConfigured()) {
    return [] satisfies AdminProductFeedbackEntry[];
  }

  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("shop_product_feedback")
    .select(
      `
        id,
        product_id,
        author_name,
        contact,
        body,
        rating,
        status,
        created_at,
        updated_at,
        shop_products (
          slug,
          title_ko
        )
      `,
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Product feedback query failed: ${error.message}`);
  }

  const rows = (data ?? []) as ProductFeedbackRow[];
  const imageMap = await readFeedbackImagesByFeedbackIds(rows.map((row) => row.id));

  return rows.map((row) => ({
    authorName: row.author_name,
    body: row.body,
    contact: row.contact,
    createdAt: row.created_at,
    id: row.id,
    images: imageMap.get(row.id) ?? [],
    productId: row.product_id,
    productSlug: row.shop_products?.slug ?? null,
    productTitle: row.shop_products?.title_ko ?? null,
    rating: row.rating,
    status: row.status,
    updatedAt: row.updated_at,
  }));
}

export async function updateAdminProductFeedbackStatus({
  feedbackId,
  status,
}: {
  feedbackId: string;
  status: AdminProductFeedbackStatus;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase feedback storage is not configured.");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_product_feedback")
    .update({ status })
    .eq("id", feedbackId)
    .select("id, product_id, shop_products (slug)")
    .single();

  if (error) {
    throw new Error(`Product feedback status update failed: ${error.message}`);
  }

  const row = data as {
    id: string;
    product_id: string;
    shop_products?: {
      slug?: string | null;
    } | null;
  };

  return {
    feedbackId: row.id,
    productId: row.product_id,
    productSlug: row.shop_products?.slug ?? null,
    status,
  };
}
