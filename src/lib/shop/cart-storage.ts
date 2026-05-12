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

const emptyCartSnapshot: CartSnapshot = {
  items: [],
  updatedAt: "",
  version: 1,
};

export function readCartSnapshot(): CartSnapshot {
  if (typeof window === "undefined") {
    return emptyCartSnapshot;
  }

  const rawValue = window.localStorage.getItem(cartStorageKey);

  if (!rawValue) {
    return emptyCartSnapshot;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<CartSnapshot>;
    const items = Array.isArray(parsed.items)
      ? parsed.items.map(normalizeCartItem).filter(isCartItem)
      : [];

    return {
      items,
      updatedAt:
        typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
      version: 1,
    };
  } catch {
    return emptyCartSnapshot;
  }
}

export function addCartItem(input: CartItemInput, maxQuantity = 99) {
  const current = readCartSnapshot();
  const now = new Date().toISOString();
  const key = getCartItemKey(input);
  let nextItems = current.items;
  const existingItem = current.items.find((item) => getCartItemKey(item) === key);

  if (existingItem) {
    nextItems = current.items.map((item) =>
      getCartItemKey(item) === key
        ? {
            ...item,
            quantity: clampQuantity(item.quantity + input.quantity, maxQuantity),
            updatedAt: now,
          }
        : item,
    );
  } else {
    nextItems = [
      {
        ...input,
        addedAt: now,
        quantity: clampQuantity(input.quantity, maxQuantity),
        updatedAt: now,
      },
      ...current.items,
    ];
  }

  return writeCartSnapshot({
    items: nextItems,
    updatedAt: now,
    version: 1,
  });
}

export function updateCartItemQuantity(
  key: string,
  quantity: number,
  maxQuantity = 99,
) {
  const current = readCartSnapshot();
  const now = new Date().toISOString();
  const nextItems = current.items
    .map((item) =>
      getCartItemKey(item) === key
        ? {
            ...item,
            quantity: clampQuantity(quantity, maxQuantity),
            updatedAt: now,
          }
        : item,
    )
    .filter((item) => item.quantity > 0);

  return writeCartSnapshot({
    items: nextItems,
    updatedAt: now,
    version: 1,
  });
}

export function removeCartItem(key: string) {
  const current = readCartSnapshot();
  const now = new Date().toISOString();

  return writeCartSnapshot({
    items: current.items.filter((item) => getCartItemKey(item) !== key),
    updatedAt: now,
    version: 1,
  });
}

export function clearCart() {
  return writeCartSnapshot({
    items: [],
    updatedAt: new Date().toISOString(),
    version: 1,
  });
}

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

export function getCartItemCount(snapshot = readCartSnapshot()) {
  return snapshot.items.reduce((total, item) => total + item.quantity, 0);
}

function writeCartSnapshot(snapshot: CartSnapshot) {
  if (typeof window === "undefined") {
    return snapshot;
  }

  window.localStorage.setItem(cartStorageKey, JSON.stringify(snapshot));
  window.dispatchEvent(
    new CustomEvent<CartChangedDetail>(cartChangedEventName, {
      detail: { snapshot },
    }),
  );

  return snapshot;
}

function normalizeCartItem(value: unknown): CartItem | null {
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
    quantity: clampQuantity(Number(item.quantity)),
    shippingMethod: item.shippingMethod === "pickup" ? "pickup" : "parcel",
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
  };
}

function isCartItem(item: CartItem | null): item is CartItem {
  return Boolean(item);
}

function clampQuantity(quantity: number, maxQuantity = 99) {
  if (!Number.isFinite(quantity)) {
    return 1;
  }

  return Math.min(Math.max(1, Math.floor(quantity)), maxQuantity);
}
