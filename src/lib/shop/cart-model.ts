import type { ProductOption, ShippingMethod } from "@/lib/orders/order-model";

export const cartChangedEventName = "consepot:cart-changed";
export const cartStorageKey = "consepot_cart_v1";

export type CartItem = {
  addedAt: string;
  madeToOrder: boolean;
  productOption: ProductOption;
  productSlug: string;
  quantity: number;
  shippingMethod: ShippingMethod;
  updatedAt: string;
};

export type CartSnapshot = {
  items: CartItem[];
  updatedAt: string;
  version: 1;
};

export type CartItemInput = Omit<CartItem, "addedAt" | "updatedAt">;

export type CartChangedDetail = {
  snapshot: CartSnapshot;
};

export const emptyCartSnapshot: CartSnapshot = {
  items: [],
  updatedAt: "",
  version: 1,
};

export function getCartItemKey({
  madeToOrder,
  productOption,
  productSlug,
  shippingMethod,
}: Pick<
  CartItem,
  "madeToOrder" | "productOption" | "productSlug" | "shippingMethod"
>) {
  return [
    productSlug,
    productOption,
    shippingMethod,
    madeToOrder ? "made_to_order" : "stock",
  ].join("|");
}

export function getCartItemCount(snapshot = emptyCartSnapshot) {
  return snapshot.items.reduce((total, item) => total + item.quantity, 0);
}

export function normalizeCartItem(value: unknown): CartItem | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const item = value as Partial<CartItem>;
  const productSlug =
    typeof item.productSlug === "string" ? item.productSlug.trim() : "";

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productSlug)) {
    return null;
  }

  return {
    addedAt: typeof item.addedAt === "string" ? item.addedAt : "",
    madeToOrder: Boolean(item.madeToOrder),
    productOption:
      item.productOption === "plant_included"
        ? "plant_included"
        : "plant_excluded",
    productSlug,
    quantity: clampCartQuantity(Number(item.quantity)),
    shippingMethod: item.shippingMethod === "pickup" ? "pickup" : "parcel",
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
  };
}

export function normalizeCartSnapshot(value: unknown): CartSnapshot {
  if (typeof value !== "object" || value === null) {
    return emptyCartSnapshot;
  }

  const snapshot = value as Partial<CartSnapshot>;
  const items = Array.isArray(snapshot.items)
    ? snapshot.items.map(normalizeCartItem).filter(isCartItem)
    : [];

  return {
    items,
    updatedAt:
      typeof snapshot.updatedAt === "string" ? snapshot.updatedAt : "",
    version: 1,
  };
}

export function clampCartQuantity(quantity: number, maxQuantity = 99) {
  if (!Number.isFinite(quantity)) {
    return 1;
  }

  return Math.min(Math.max(1, Math.floor(quantity)), maxQuantity);
}

function isCartItem(item: CartItem | null): item is CartItem {
  return Boolean(item);
}
