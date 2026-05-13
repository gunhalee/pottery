export const adminMediaImageSizes = {
  adminEditorImage: "(max-width: 900px) calc(100vw - 64px), 760px",
  adminMediaThumbnail: "(max-width: 640px) 42vw, 180px",
  adminPreviewCover: "(max-width: 640px) calc(100vw - 64px), 420px",
  adminReviewThumbnail: "(max-width: 640px) 18vw, 160px",
} as const;

export const contentMediaImageSizes = {
  contentCover: "(max-width: 900px) 100vw, 1180px",
  contentDetailStrip: "(max-width: 760px) 100vw, 50vw",
  reviewThumbnail: "(max-width: 640px) calc((100vw - 72px) / 3), 128px",
} as const;

export const galleryMediaImageSizes = {
  galleryCard: "(max-width: 760px) 50vw, (max-width: 1100px) 33vw, 384px",
  galleryYoutubeThumbnail:
    "(max-width: 640px) 28vw, (max-width: 1180px) 15vw, 180px",
} as const;

export const shopMediaImageSizes = {
  cartItem: "(max-width: 720px) 96px, 132px",
  productCard:
    "(max-width: 640px) calc(100vw - 48px), (max-width: 900px) calc((100vw - 60px) / 2), (max-width: 1250px) calc((100vw - 136px) / 3), 392px",
  productDetailHero:
    "(max-width: 900px) calc(100vw - 48px), (max-width: 1200px) 54vw, 840px",
  productDetailThumbnail: "(max-width: 640px) 58px, 80px",
} as const;

export const siteMediaImageSizes = {
  homeHero: "100vw",
  naverMapPreview: "(max-width: 900px) 100vw, 900px",
} as const;

export const mediaImageSizes = {
  ...adminMediaImageSizes,
  ...contentMediaImageSizes,
  ...galleryMediaImageSizes,
  ...shopMediaImageSizes,
  ...siteMediaImageSizes,
} as const;
