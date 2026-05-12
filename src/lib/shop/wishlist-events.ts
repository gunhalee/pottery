export const wishlistChangedEventName = "consepot:wishlist-changed";

export type WishlistChangedDetail = {
  productSlug: string;
  wished: boolean;
};

export function dispatchWishlistChanged(detail: WishlistChangedDetail) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<WishlistChangedDetail>(wishlistChangedEventName, {
      detail,
    }),
  );
}
