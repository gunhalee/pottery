export type MediaOwnerType = "content_entry" | "product";

export type MediaUsageRole =
  | "body"
  | "cover"
  | "description"
  | "detail"
  | "list";

export type MediaVariantName = "detail" | "list" | "master" | "thumbnail";

export type MediaAsset = {
  alt: string;
  artworkTitle?: string;
  bucket: string;
  caption?: string;
  createdAt: string;
  height: number;
  id: string;
  masterPath: string;
  mimeType: string;
  reserved: boolean;
  sizeBytes?: number;
  src: string;
  updatedAt: string;
  variants: MediaVariant[];
  width: number;
};

export type MediaVariant = {
  assetId: string;
  createdAt: string;
  height: number;
  id: string;
  sizeBytes?: number;
  src: string;
  storagePath: string;
  variant: MediaVariantName;
  width: number;
};

export type MediaUsage = {
  altOverride?: string;
  asset: MediaAsset;
  assetId: string;
  captionOverride?: string;
  createdAt: string;
  id: string;
  layout?: string;
  ownerId: string;
  ownerType: MediaOwnerType;
  role: MediaUsageRole;
  sortOrder: number;
  updatedAt: string;
};
