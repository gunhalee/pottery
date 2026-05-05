import type { ConsepotProduct } from "@/lib/shop";
import { ProductCard } from "./product-card";

export function ProductGrid({ products }: { products: ConsepotProduct[] }) {
  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

