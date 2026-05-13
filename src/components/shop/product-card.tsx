import { ArtworkImage } from "@/components/media/artwork-image";
import { SiteLink } from "@/components/navigation/site-link";
import { SiteArrowLink } from "@/components/site/actions";
import {
  artworkPlaceholderImage,
  getArtworkPlaceholderAlt,
} from "@/lib/media/media-placeholders";
import { mediaImageSizes } from "@/lib/media/media-image-sizes";
import {
  formatProductPrice,
  getProductBadges,
  getProductListImage,
  type ProductListItem,
} from "@/lib/shop";
import { ProductBadge } from "./product-badge";
import { ProductWishlistButtonLoader } from "./product-wishlist-button-loader";

export function ProductCard({
  imagePriority = false,
  initialWished,
  product,
}: {
  imagePriority?: boolean;
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
            fetchPriority={imagePriority ? "high" : "auto"}
            fill
            loading={imagePriority ? "eager" : "lazy"}
            quality={70}
            sizes={mediaImageSizes.productCard}
            src={primaryImage.src}
          />
        ) : (
          <ArtworkImage
            alt={getArtworkPlaceholderAlt(product.titleKo)}
            className="product-card-image product-card-placeholder-image"
            fetchPriority={imagePriority ? "high" : "auto"}
            fill
            loading={imagePriority ? "eager" : "lazy"}
            quality={70}
            sizes={mediaImageSizes.productCard}
            src={artworkPlaceholderImage.src}
          />
        )}
      </SiteLink>
      <ProductWishlistButtonLoader
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
          <SiteArrowLink
            className="product-card-link"
            href={`/shop/${product.slug}`}
          >
            자세히 보기
          </SiteArrowLink>
        </div>
      </div>
    </article>
  );
}
