import type { ProductListItem } from "@/lib/shop";
import { ProductCard } from "./product-card";

export function ProductGrid({
  products,
  wishedProductIds,
}: {
  products: ProductListItem[];
  wishedProductIds?: readonly string[];
}) {
  const wishedProductIdSet = wishedProductIds
    ? new Set(wishedProductIds)
    : null;

  return (
    <div className="product-grid">
      {products.map((product, index) => (
        <ProductCard
          imagePriority={index === 0}
          initialWished={wishedProductIdSet?.has(product.id)}
          key={product.id}
          product={product}
        />
      ))}
    </div>
  );
}
