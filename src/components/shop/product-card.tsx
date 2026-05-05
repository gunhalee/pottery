import Link from "next/link";
import { PlaceholderFrame } from "@/components/site/primitives";
import {
  formatProductPrice,
  getProductBadges,
  type ConsepotProduct,
} from "@/lib/shop";
import { ProductBadge } from "./product-badge";

export function ProductCard({ product }: { product: ConsepotProduct }) {
  const primaryImage = product.images.find((image) => image.isPrimary);

  return (
    <article className="product-card">
      <Link
        aria-label={`${product.titleKo} 상세 보기`}
        className="product-card-image-link"
        href={`/shop/${product.slug}`}
        prefetch={false}
      >
        <PlaceholderFrame
          className="product-card-image"
          label={primaryImage?.placeholderLabel ?? product.titleKo}
          tone={product.kind === "one_of_a_kind" ? "dark" : "light"}
        />
      </Link>
      <div className="product-card-body">
        <div className="product-badge-row">
          {getProductBadges(product).map((badge) => (
            <ProductBadge key={badge} kind={badge} />
          ))}
        </div>
        <h2 className="product-card-title">
          <Link href={`/shop/${product.slug}`} prefetch={false}>
            {product.titleKo}
          </Link>
        </h2>
        <p className="product-card-description">{product.shortDescription}</p>
        <div className="product-card-price">{formatProductPrice(product)}</div>
        <Link
          className="product-card-link link-arrow"
          href={`/shop/${product.slug}`}
          prefetch={false}
        >
          자세히 보기
        </Link>
      </div>
    </article>
  );
}
