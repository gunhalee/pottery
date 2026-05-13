import Image from "next/image";

type ArtworkImageProps = {
  alt: string;
  className?: string;
  fetchPriority?: "auto" | "high" | "low";
  fill?: boolean;
  height?: number;
  loading?: "eager" | "lazy";
  preload?: boolean;
  quality?: 70 | 75;
  sizes: string;
  src: string;
  width?: number;
};

const defaultImageSize = 1200;

export function ArtworkImage({
  alt,
  className,
  fetchPriority,
  fill = false,
  height,
  loading = "lazy",
  preload = false,
  quality = 75,
  sizes,
  src,
  width,
}: ArtworkImageProps) {
  const loadingMode = preload ? undefined : loading;

  if (fill) {
    return (
      <Image
        alt={alt}
        className={className}
        decoding="async"
        fetchPriority={fetchPriority}
        fill
        loading={loadingMode}
        preload={preload}
        quality={quality}
        sizes={sizes}
        src={src}
      />
    );
  }

  return (
    <Image
      alt={alt}
      className={className}
      decoding="async"
      fetchPriority={fetchPriority}
      height={height ?? defaultImageSize}
      loading={loadingMode}
      preload={preload}
      quality={quality}
      sizes={sizes}
      src={src}
      width={width ?? defaultImageSize}
    />
  );
}
