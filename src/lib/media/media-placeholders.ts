export const artworkPlaceholderImage = {
  height: 1783,
  id: "placeholder-product-image",
  src: "/asset/hero-image.jpg",
  width: 3156,
} as const;

export function getArtworkPlaceholderAlt(title?: string) {
  return title ? `${title} 이미지 준비 중` : "이미지 준비 중";
}
