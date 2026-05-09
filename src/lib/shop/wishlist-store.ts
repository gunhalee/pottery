import "server-only";

import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export type WishlistItemState = {
  wished: boolean;
};

export async function getWishlistItemState(
  wishlistId: string,
  productId: string,
): Promise<WishlistItemState> {
  if (!isSupabaseConfigured()) {
    return { wished: false };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_wishlist_items")
    .select("product_id")
    .eq("wishlist_id", wishlistId)
    .eq("product_id", productId)
    .maybeSingle();

  if (error) {
    if (isMissingWishlistStorageError(error)) {
      return { wished: false };
    }

    throw new Error(`Supabase wishlist query failed: ${error.message}`);
  }

  return { wished: Boolean(data) };
}

export async function setWishlistItem({
  productId,
  wished,
  wishlistId,
}: {
  productId: string;
  wished: boolean;
  wishlistId: string;
}): Promise<WishlistItemState> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase wishlist storage is not configured.");
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error: wishlistError } = await supabase
    .from("shop_wishlists")
    .upsert(
      {
        id: wishlistId,
        last_seen_at: now,
      },
      { onConflict: "id" },
    );

  if (wishlistError) {
    throw new Error(`Supabase wishlist upsert failed: ${wishlistError.message}`);
  }

  if (wished) {
    const { error } = await supabase.from("shop_wishlist_items").upsert(
      {
        product_id: productId,
        wishlist_id: wishlistId,
      },
      { onConflict: "wishlist_id,product_id" },
    );

    if (error) {
      throw new Error(`Supabase wishlist item upsert failed: ${error.message}`);
    }

    return { wished: true };
  }

  const { error } = await supabase
    .from("shop_wishlist_items")
    .delete()
    .eq("wishlist_id", wishlistId)
    .eq("product_id", productId);

  if (error) {
    throw new Error(`Supabase wishlist item delete failed: ${error.message}`);
  }

  return { wished: false };
}

function isMissingWishlistStorageError(error: { code?: string; message?: string }) {
  const message = error.message ?? "";

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (message.includes("shop_wishlist") &&
      (message.includes("schema cache") ||
        message.includes("does not exist") ||
        message.includes("relation")))
  );
}
