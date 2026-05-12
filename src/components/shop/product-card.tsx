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
import { ProductWishlistButton } from "./product-wishlist-button";

export function ProductCard({
  initialWished,
  product,
}: {
  initialWished?: boolean;
  product: ProductListItem;
}) {
  const primaryImage = getProductListImage(product);
  const badges = getProductBadges(product);

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
      <ProductWishlistButton
        className="product-card-wish-button"
        initialWished={initialWished}
        productSlug={product.slug}
        productTitle={product.titleKo}
      />
      <div className="product-card-body">
        <div className="product-card-heading">
          <div className="product-card-title-line">
            <h2 className="product-card-title">
              <SiteLink href={`/shop/${product.slug}`}>
                {product.titleKo}
              </SiteLink>
            </h2>
            <div className="product-badge-row">
              {badges.map((badge) => (
                <ProductBadge key={badge} kind={badge} />
              ))}
            </div>
          </div>
          <div className="product-card-price">{formatProductPrice(product)}</div>
        </div>
        <div className="product-card-secondary">
          <p className="product-card-description">{product.shortDescription}</p>
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
