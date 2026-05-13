import "server-only";

import {
  getContentAdminPath,
  readContentEntries,
} from "@/lib/content-manager/content-store";
import { walkLexicalNodes } from "@/lib/content-manager/rich-text-utils";
import { mediaAssetBucket } from "@/lib/media/media-store";
import { readProducts } from "@/lib/shop/product-store";
import type {
  MediaReferenceItem,
  ProductContentLinkItem,
} from "./types";

type Product = Awaited<ReturnType<typeof readProducts>>[number];
type ContentEntry = Awaited<ReturnType<typeof readContentEntries>>[number];

export function buildMediaReferenceData({
  entries,
  products,
}: {
  entries: ContentEntry[];
  products: Product[];
}) {
  const productBySlug = new Map(products.map((product) => [product.slug, product]));
  const mediaReferences: MediaReferenceItem[] = [];
  const productContentLinks: ProductContentLinkItem[] = [];

  for (const product of products) {
    for (const [index, image] of product.images.entries()) {
      if (!image.storagePath) {
        continue;
      }

      const roles = [
        image.isPrimary ? "대표" : null,
        image.isListImage ? "목록" : null,
        image.isDetail ? "상세 갤러리" : null,
        image.isDescription ? "설명 삽입" : null,
      ].filter((role): role is string => Boolean(role));

      mediaReferences.push({
        bucket: mediaAssetBucket,
        ownerHref: `/admin/products/${product.id}`,
        ownerTitle: product.titleKo,
        ownerType: "product",
        role: roles.join(" / ") || (index === 0 ? "첨부" : "상세 이미지"),
        status: "referenced",
        storagePath: image.storagePath,
      });
    }
  }

  for (const entry of entries) {
    const imageIdsInBody = new Set(
      walkLexicalNodes(entry.body)
        .filter((node) => node.type === "content-image")
        .map((node) => node.id)
        .filter((id): id is string => typeof id === "string"),
    );

    for (const image of entry.images) {
      const roles = [
        image.isCover ? "대표" : null,
        image.isListImage ? "목록" : null,
        image.isDetail ? "상세 하단" : null,
        image.isReserved ? "보관" : null,
        imageIdsInBody.has(image.id) ? "본문" : null,
      ].filter((role): role is string => Boolean(role));

      mediaReferences.push({
        bucket: mediaAssetBucket,
        createdAt: image.createdAt,
        ownerHref: `${getContentAdminPath(entry.kind)}/${entry.id}`,
        ownerTitle: entry.title,
        ownerType: entry.kind,
        role: roles.join(" / ") || "첨부만 됨",
        status:
          roles.length > 0
            ? "referenced"
            : entry.status === "draft"
              ? "attached"
              : "body-unlinked",
        storagePath: image.storagePath,
      });
    }

    if (entry.relatedProductSlug) {
      const product = productBySlug.get(entry.relatedProductSlug);

      productContentLinks.push({
        contentHref: `${getContentAdminPath(entry.kind)}/${entry.id}`,
        contentKind: entry.kind,
        contentTitle: entry.title,
        productSlug: entry.relatedProductSlug,
        productTitle: product?.titleKo ?? "연결 상품 없음",
        status: product ? "linked" : "missing-product",
      });
    }
  }

  return {
    mediaReferences: mediaReferences.sort((a, b) =>
      a.ownerTitle.localeCompare(b.ownerTitle, "ko-KR"),
    ),
    productContentLinks,
  };
}
