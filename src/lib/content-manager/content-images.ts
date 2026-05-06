import { pickVariantSource } from "@/lib/media/media-variant-policy";
import type { ContentEntry, ContentImage } from "./content-model";

type ContentImageSource = Pick<ContentEntry, "images">;

export function getContentCoverImage(entry: ContentEntry) {
  const image = entry.images.find((item) => item.isCover) ?? null;
  return image ? withContentImageVariant(image, "detail") : null;
}

export function getContentDetailImages(entry: ContentEntry) {
  return entry.images
    .filter((image) => image.isDetail)
    .map((image) => withContentImageVariant(image, "detail"));
}

export function getContentListImage(entry: ContentImageSource) {
  const image =
    entry.images.find((item) => item.isListImage) ??
    entry.images.find((item) => item.isCover) ??
    entry.images.find((item) => item.src) ??
    null;

  return image ? withContentImageVariant(image, "list") : null;
}

export function withContentImageVariant(
  image: ContentImage,
  surface: "detail" | "list" | "master" | "thumbnail",
) {
  const variant = pickVariantSource(image.variants, surface);

  if (!variant) {
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
