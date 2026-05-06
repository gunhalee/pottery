import { ArtworkImage } from "@/components/media/artwork-image";
import { SiteLink } from "@/components/navigation/site-link";
import { PlaceholderFrame } from "@/components/site/primitives";
import {
  formatProductPrice,
  getProductBadges,
  getProductListImage,
  type ConsepotProduct,
} from "@/lib/shop";
import { ProductBadge } from "./product-badge";

export function ProductCard({ product }: { product: ConsepotProduct }) {
  const primaryImage = getProductListImage(product);

  return (
    <article className="product-card">
      <SiteLink
        aria-label={`${product.titleKo} 상세 보기`}
        className="product-card-image-link"
        href={`/shop/${product.slug}`}
      >
        {primaryImage?.src ? (
          <ArtworkImage
            alt={primaryImage.alt}
            className="product-card-image"
            fill
            loading="lazy"
            sizes="(max-width: 760px) 50vw, (max-width: 1100px) 33vw, 384px"
            src={primaryImage.src}
          />
        ) : (
          <PlaceholderFrame
            className="product-card-image"
            label={primaryImage?.placeholderLabel ?? product.titleKo}
            tone={product.kind === "one_of_a_kind" ? "dark" : "light"}
          />
        )}
      </SiteLink>
      <div className="product-card-body">
        <h2 className="product-card-title">
          <SiteLink href={`/shop/${product.slug}`}>
            {product.titleKo}
          </SiteLink>
        </h2>
        <div className="product-card-secondary">
          <div className="product-badge-row">
            {getProductBadges(product).map((badge) => (
              <ProductBadge key={badge} kind={badge} />
            ))}
          </div>
          <p className="product-card-description">{product.shortDescription}</p>
          <div className="product-card-price">{formatProductPrice(product)}</div>
          <SiteLink
            className="product-card-link link-arrow"
            href={`/shop/${product.slug}`}
          >
            자세히 보기
          </SiteLink>
        </div>
      </div>
    </article>
  );
}
