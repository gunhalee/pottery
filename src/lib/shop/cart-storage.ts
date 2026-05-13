import {
  cartChangedEventName,
  cartStorageKey,
  emptyCartSnapshot,
  getCartItemCount,
  getCartItemKey,
  normalizeCartSnapshot,
  type CartChangedDetail,
  type CartItem,
  type CartItemInput,
  type CartSnapshot,
} from "./cart-model";

export {
  cartChangedEventName,
  cartStorageKey,
  emptyCartSnapshot,
  getCartItemCount,
  getCartItemKey,
  type CartChangedDetail,
  type CartItem,
  type CartItemInput,
  type CartSnapshot,
};

export async function readCartSnapshot(): Promise<CartSnapshot> {
  return requestCartSnapshot("/api/cart", {
    method: "GET",
  });
}

export async function addCartItem(input: CartItemInput) {
  return requestCartSnapshot("/api/cart", {
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

export async function updateCartItemQuantity(key: string, quantity: number) {
  return requestCartSnapshot("/api/cart", {
    body: JSON.stringify({ key, quantity }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });
}

export async function removeCartItem(key: string) {
  return requestCartSnapshot("/api/cart", {
    body: JSON.stringify({ key }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "DELETE",
  });
}

export async function clearCart() {
  return requestCartSnapshot("/api/cart", {
    body: JSON.stringify({ all: true }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "DELETE",
  });
}

export function dispatchCartChanged(snapshot: CartSnapshot) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<CartChangedDetail>(cartChangedEventName, {
      detail: { snapshot },
    }),
  );
}

async function requestCartSnapshot(
  input: RequestInfo | URL,
  init: RequestInit,
) {
  if (typeof window === "undefined") {
    return emptyCartSnapshot;
  }

  const response = await fetch(input, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const errorMessage =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "장바구니 정보를 처리하지 못했습니다.";

    throw new Error(errorMessage);
  }

  const snapshot = normalizeCartSnapshot(payload);
  dispatchCartChanged(snapshot);

  return snapshot;
}
