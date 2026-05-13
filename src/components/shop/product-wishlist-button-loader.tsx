"use client";

import dynamic from "next/dynamic";
import type { ProductWishlistButtonProps } from "./product-wishlist-button";

const ProductWishlistButton = dynamic(
  () =>
    import("./product-wishlist-button").then(
      (mod) => mod.ProductWishlistButton,
    ),
  { ssr: false },
);

export function ProductWishlistButtonLoader(props: ProductWishlistButtonProps) {
  return <ProductWishlistButton {...props} />;
}
