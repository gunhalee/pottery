import {
  formatProductPrice,
  getProductListImage,
  type ProductListItem,
} from "@/lib/shop";

export type ProductListSummary = {
  href: string;
  imageAlt: string;
  imageSrc: string | null;
  price: string;
  slug: string;
  title: string;
};

export function toProductListSummary(
  product: ProductListItem,
): ProductListSummary {
  const image = getProductListImage(product);

  return {
    href: `/shop/${product.slug}`,
    imageAlt: image?.alt ?? product.titleKo,
    imageSrc: image?.src ?? null,
    price: formatProductPrice(product),
    slug: product.slug,
    title: product.titleKo,
  };
}
