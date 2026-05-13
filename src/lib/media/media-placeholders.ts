export const artworkPlaceholderImage = {
  height: 1085,
  id: "placeholder-product-image",
  src: "/asset/hero-poster.webp",
  width: 1920,
} as const;

export function getArtworkPlaceholderAlt(title?: string) {
  return title ? `${title} 이미지 준비 중` : "이미지 준비 중";
}
