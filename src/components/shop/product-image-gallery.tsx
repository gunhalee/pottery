import { ArtworkImage } from "@/components/media/artwork-image";
import { mediaImageSizes } from "@/lib/media/media-image-sizes";
import type { ProductGalleryImage } from "@/lib/shop/product-images";
import { ProductImageGalleryCarousel } from "./product-image-gallery-carousel";

export function ProductImageGallery({
  images,
  productTitle,
}: {
  images: ProductGalleryImage[];
  productTitle: string;
}) {
  if (images.length > 1) {
    return (
      <ProductImageGalleryCarousel images={images} productTitle={productTitle} />
    );
  }

  const image = images[0];

  if (!image) {
    return null;
  }

  return (
    <div className="product-image-gallery">
      <div className="product-gallery-main">
        <ArtworkImage
          alt={image.alt}
          className="product-detail-image product-detail-photo"
          fetchPriority="high"
          fill
          loading="eager"
          preload
          quality={70}
          sizes={mediaImageSizes.productDetailHero}
          src={image.src}
        />
      </div>
    </div>
  );
}
