import "server-only";

import {
  clampCartQuantity,
  emptyCartSnapshot,
  getCartItemKey,
  type CartItem,
  type CartItemInput,
  type CartSnapshot,
} from "@/lib/shop/cart-model";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export type CartStoreItemInput = CartItemInput & {
  maxQuantity?: number;
  productId: string;
};

type CartItemRow = {
  added_at: string;
  made_to_order: boolean;
  option_key: string;
  product_option: "plant_excluded" | "plant_included";
  product_slug: string;
  quantity: number;
  shipping_method: "parcel" | "pickup";
  updated_at: string;
};

export async function getCartSnapshotForSession(
  sessionId: string | null,
): Promise<CartSnapshot> {
  if (!isSupabaseConfigured() || !sessionId) {
    return emptyCartSnapshot;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_cart_items")
    .select(
      "product_slug, product_option, shipping_method, made_to_order, quantity, added_at, updated_at, option_key",
    )
    .eq("session_id", sessionId)
    .order("added_at", { ascending: false });

  if (error) {
    throw new Error(`Supabase cart query failed: ${error.message}`);
  }

  return toCartSnapshot((data ?? []) as CartItemRow[]);
}

export async function addCartItemForSession({
  maxQuantity = 99,
  productId,
  ...input
}: CartStoreItemInput & {
  sessionId: string;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase cart storage is not configured.");
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const optionKey = getCartItemKey(input);
  const quantity = clampCartQuantity(input.quantity, maxQuantity);
  const { data: existing, error: existingError } = await supabase
    .from("shop_cart_items")
    .select("quantity")
    .eq("session_id", input.sessionId)
    .eq("product_id", productId)
    .eq("option_key", optionKey)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Supabase cart item query failed: ${existingError.message}`);
  }

  if (existing) {
    const nextQuantity = clampCartQuantity(
      Number((existing as { quantity: number }).quantity) + quantity,
      maxQuantity,
    );
    const { error } = await supabase
      .from("shop_cart_items")
      .update({
        quantity: nextQuantity,
        updated_at: now,
      })
      .eq("session_id", input.sessionId)
      .eq("product_id", productId)
      .eq("option_key", optionKey);

    if (error) {
      throw new Error(`Supabase cart item update failed: ${error.message}`);
    }

    return getCartSnapshotForSession(input.sessionId);
  }

  const { error } = await supabase.from("shop_cart_items").insert({
    added_at: now,
    made_to_order: input.madeToOrder,
    option_key: optionKey,
    product_id: productId,
    product_option: input.productOption,
    product_slug: input.productSlug,
    quantity,
    session_id: input.sessionId,
    shipping_method: input.shippingMethod,
    updated_at: now,
  });

  if (error) {
    throw new Error(`Supabase cart item insert failed: ${error.message}`);
  }

  return getCartSnapshotForSession(input.sessionId);
}

export async function updateCartItemQuantityForSession({
  key,
  maxQuantity = 99,
  quantity,
  sessionId,
}: {
  key: string;
  maxQuantity?: number;
  quantity: number;
  sessionId: string;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase cart storage is not configured.");
  }

  const supabase = getSupabaseAdminClient();
  const nextQuantity = clampCartQuantity(quantity, maxQuantity);
  const { error } = await supabase
    .from("shop_cart_items")
    .update({
      quantity: nextQuantity,
      updated_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId)
    .eq("option_key", key);

  if (error) {
    throw new Error(`Supabase cart item quantity update failed: ${error.message}`);
  }

  return getCartSnapshotForSession(sessionId);
}

export async function removeCartItemForSession({
  key,
  sessionId,
}: {
  key: string;
  sessionId: string;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase cart storage is not configured.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("shop_cart_items")
    .delete()
    .eq("session_id", sessionId)
    .eq("option_key", key);

  if (error) {
    throw new Error(`Supabase cart item delete failed: ${error.message}`);
  }

  return getCartSnapshotForSession(sessionId);
}

export async function clearCartForSession(sessionId: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase cart storage is not configured.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("shop_cart_items")
    .delete()
    .eq("session_id", sessionId);

  if (error) {
    throw new Error(`Supabase cart clear failed: ${error.message}`);
  }

  return getCartSnapshotForSession(sessionId);
}

function toCartSnapshot(rows: CartItemRow[]): CartSnapshot {
  const items = rows.map(
    (row): CartItem => ({
      addedAt: row.added_at,
      madeToOrder: row.made_to_order,
      productOption: row.product_option,
      productSlug: row.product_slug,
      quantity: clampCartQuantity(row.quantity),
      shippingMethod: row.shipping_method,
      updatedAt: row.updated_at,
    }),
  );

  return {
    items,
    updatedAt: items[0]?.updatedAt ?? "",
    version: 1,
  };
}
