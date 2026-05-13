import {
  buildMediaVariantSources,
  pickVariantSource,
} from "@/lib/media/media-variant-policy";
import type {
  MediaVariantSurface,
  PickMediaVariantOptions,
} from "@/lib/media/media-variant-policy";
import type { MediaAsset } from "@/lib/media/media-model";
import type { ProductImage, ProductListItem } from "./product-model";

type ProductImageSource = Pick<ProductListItem, "images">;

export type ProductGalleryImage = {
  alt: string;
  height?: number;
  id: string;
  src: string;
  thumbnailHeight?: number;
  thumbnailSrc?: string;
  thumbnailWidth?: number;
  width?: number;
};

export function getProductPrimaryImage(product: ProductImageSource) {
  const image =
    product.images.find((item) => item.isPrimary && item.src) ??
    product.images.find((item) => item.src) ??
    product.images.find((item) => item.isPrimary) ??
    product.images[0] ??
    null;

  return image ? withProductImageVariant(image, "detail") : null;
}

export function getProductListImage(product: ProductImageSource) {
  const image =
    product.images.find(
      (item) => item.isListImage && hasExactOrExternalImageSource(item, "list"),
    ) ?? null;

  return image ? withProductImageVariant(image, "list") : null;
}

export function getProductCartImage(product: ProductImageSource) {
  return getProductListImage(product);
}

export function getProductDisplayImages(product: ProductImageSource) {
  return product.images
    .filter(
      (image) =>
        hasExactOrExternalImageSource(image, "detail") &&
        (image.isDetail || image.isPrimary),
    )
    .map((image) => withProductImageVariant(image, "detail"));
}

export function getProductThumbnailImage(image: ProductImage) {
  return withProductImageVariant(image, "thumbnail");
}

export function getProductAdminPreviewSource(image: ProductImage) {
  return pickVariantSource(image.variants, "thumbnail", {
    allowFallback: true,
  });
}

export function createProductImageFromMediaAsset(asset: MediaAsset): ProductImage {
  const variants = buildMediaVariantSources(asset);
  const detail = pickVariantSource(variants, "detail", {
    allowFallback: true,
  });

  return {
    alt: asset.alt,
    caption: asset.caption,
    height: detail?.height ?? asset.height,
    id: asset.id,
    isDetail: true,
    isListImage: false,
    isPrimary: false,
    src: detail?.src ?? asset.src,
    storagePath: asset.masterPath,
    variants,
    width: detail?.width ?? asset.width,
  };
}

export function getProductGalleryImages(
  product: ProductImageSource,
): ProductGalleryImage[] {
  const primaryImage = getProductPrimaryImage(product);
  const displayImages = getProductDisplayImages(product);
  const images =
    displayImages.length > 0 ? displayImages : primaryImage ? [primaryImage] : [];
  const seen = new Set<string>();
  const galleryImages: ProductGalleryImage[] = [];

  for (const image of images) {
    if (!image.src || seen.has(image.src)) {
      continue;
    }

    seen.add(image.src);
    const thumbnail = getProductThumbnailImage(image);

    galleryImages.push({
      alt: image.alt,
      height: image.height,
      id: image.id ?? image.src,
      src: image.src,
      thumbnailHeight: thumbnail.height,
      thumbnailSrc: thumbnail.src,
      thumbnailWidth: thumbnail.width,
      width: image.width,
    });
  }

  return galleryImages;
}

function withProductImageVariant(
  image: ProductImage,
  surface: MediaVariantSurface,
  options?: PickMediaVariantOptions,
) {
  const variant = pickVariantSource(image.variants, surface, options);

  if (!variant) {
    if (image.variants) {
      return {
        ...image,
        height: undefined,
        src: undefined,
        width: undefined,
      };
    }

    return image;
  }

  return {
    ...image,
    height: variant.height,
    src: variant.src,
    storagePath: variant.storagePath ?? image.storagePath,
    width: variant.width,
  };
}

function hasExactOrExternalImageSource(
  image: ProductImage,
  surface: MediaVariantSurface,
) {
  return Boolean(
    pickVariantSource(image.variants, surface) ??
      (!image.variants && image.src),
  );
}
