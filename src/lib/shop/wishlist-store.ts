import "server-only";

import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export type WishlistItemState = {
  wished: boolean;
};

export async function getWishlistProductIdsForSession(
  sessionId: string,
): Promise<string[]> {
  const wishlistId = await getWishlistIdForSession(sessionId);

  return wishlistId ? getWishlistProductIds(wishlistId) : [];
}

export async function getWishlistItemStateForSession(
  sessionId: string,
  productId: string,
): Promise<WishlistItemState> {
  const wishlistId = await getWishlistIdForSession(sessionId);

  if (!wishlistId) {
    return { wished: false };
  }

  return getWishlistItemState(wishlistId, productId);
}

export async function setWishlistItemForSession({
  productId,
  sessionId,
  wished,
}: {
  productId: string;
  sessionId: string;
  wished: boolean;
}): Promise<WishlistItemState> {
  const wishlistId = await getOrCreateWishlistIdForSession(sessionId);

  return setWishlistItem({
    productId,
    wished,
    wishlistId,
  });
}

export async function getWishlistProductIds(
  wishlistId: string,
): Promise<string[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_wishlist_items")
    .select("product_id")
    .eq("wishlist_id", wishlistId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Supabase wishlist list query failed: ${error.message}`);
  }

  return ((data ?? []) as Array<{ product_id: string }>).map(
    (item) => item.product_id,
  );
}

async function getWishlistIdForSession(sessionId: string) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_wishlists")
    .select("id")
    .eq("anonymous_session_id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase wishlist session query failed: ${error.message}`);
  }

  return (data as { id: string } | null)?.id ?? null;
}

async function getOrCreateWishlistIdForSession(sessionId: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase wishlist storage is not configured.");
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("shop_wishlists")
    .upsert(
      {
        anonymous_session_id: sessionId,
        last_seen_at: now,
      },
      { onConflict: "anonymous_session_id" },
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(`Supabase wishlist session upsert failed: ${error.message}`);
  }

  return (data as { id: string }).id;
}

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
