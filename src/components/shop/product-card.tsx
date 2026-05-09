import { ArtworkImage } from "@/components/media/artwork-image";
import { SiteLink } from "@/components/navigation/site-link";
import { mediaImageSizes } from "@/lib/media/media-image-sizes";
import {
  formatProductPrice,
  getProductBadges,
  getProductListImage,
  type ProductListItem,
} from "@/lib/shop";
import { ProductBadge } from "./product-badge";

export function ProductCard({ product }: { product: ProductListItem }) {
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
            sizes={mediaImageSizes.productCard}
            src={primaryImage.src}
          />
        ) : (
          <ArtworkImage
            alt={`${product.titleKo} 이미지 준비 중`}
            className="product-card-image product-card-fallback-image"
            fill
            loading="lazy"
            sizes={mediaImageSizes.productCard}
            src="/asset/hero-image.jpg"
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
