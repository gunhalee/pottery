import { ArtworkImage } from "@/components/media/artwork-image";
import { mediaImageSizes } from "@/lib/media/media-image-sizes";
import type { MediaAsset, MediaVariantSource } from "@/lib/media/media-model";
import { pickMediaVariantForSurface } from "@/lib/media/media-variant-policy";

type AdminMediaThumbnailProps = {
  alt: string;
  className?: string;
  height?: number;
  placeholder?: string;
  placeholderClassName?: string;
  sizes?: string;
  source?: MediaVariantSource | null;
  src?: string | null;
  width?: number;
};

type AdminMediaAssetThumbnailProps = Omit<
  AdminMediaThumbnailProps,
  "alt" | "height" | "source" | "src" | "width"
> & {
  alt?: string;
  asset: MediaAsset;
};

export function AdminMediaThumbnail({
  alt,
  className,
  height,
  placeholder = "이미지 없음",
  placeholderClassName = "admin-media-thumbnail-placeholder",
  sizes = mediaImageSizes.adminMediaThumbnail,
  source,
  src,
  width,
}: AdminMediaThumbnailProps) {
  const imageSrc = source?.src ?? src;

  if (!imageSrc) {
    return <div className={placeholderClassName}>{placeholder}</div>;
  }

  return (
    <ArtworkImage
      alt={alt}
      className={className}
      height={source?.height ?? height}
      loading="lazy"
      sizes={sizes}
      src={imageSrc}
      width={source?.width ?? width}
    />
  );
}

export function AdminMediaAssetThumbnail({
  alt,
  asset,
  ...thumbnailProps
}: AdminMediaAssetThumbnailProps) {
  const thumbnail = pickMediaVariantForSurface(asset, "thumbnail", {
    allowFallback: true,
  });

  return (
    <AdminMediaThumbnail
      alt={alt ?? asset.alt}
      height={asset.height}
      source={thumbnail}
      src={asset.src}
      width={asset.width}
      {...thumbnailProps}
    />
  );
}
