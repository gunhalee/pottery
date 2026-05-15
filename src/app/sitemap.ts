import type { MetadataRoute } from "next";
import {
  getContentListThumbnailImage,
} from "@/lib/content-manager/content-images";
import { getPublishedContentListEntries } from "@/lib/content-manager/content-store";
import {
  getProductListImage,
  getProductPrimaryImage,
  getPublishedProductListItems,
} from "@/lib/shop";
import { getAbsoluteUrl } from "@/lib/seo/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, galleryEntries, newsEntries] = await Promise.all([
    getPublishedProductListItems(),
    getPublishedContentListEntries("gallery"),
    getPublishedContentListEntries("news"),
  ]);
  const generatedAt = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { path: "/", priority: 1 },
    { path: "/intro", priority: 0.85 },
    { path: "/class", priority: 0.9 },
    { path: "/shop", priority: 0.9 },
    { path: "/gallery", priority: 0.78 },
    { path: "/news", priority: 0.72 },
    { path: "/terms", priority: 0.25 },
    { path: "/privacy", priority: 0.25 },
    { path: "/shipping-returns", priority: 0.25 },
  ].map(({ path, priority }) => ({
    changeFrequency: path === "/" ? "weekly" : "monthly",
    lastModified: generatedAt,
    priority,
    url: getAbsoluteUrl(path),
  }));

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => {
    const image = getProductListImage(product) ?? getProductPrimaryImage(product);

    return {
      changeFrequency: "weekly",
      images: image?.src ? [getAbsoluteUrl(image.src)] : undefined,
      lastModified: readSitemapDate(product.updatedAt, product.publishedAt, product.createdAt),
      priority: 0.72,
      url: getAbsoluteUrl(`/shop/${product.slug}`),
    };
  });

  const galleryRoutes: MetadataRoute.Sitemap = galleryEntries.map((entry) => {
    const image = getContentListThumbnailImage(entry);

    return {
      changeFrequency: "monthly",
      images: image?.src ? [getAbsoluteUrl(image.src)] : undefined,
      lastModified: readSitemapDate(entry.updatedAt, entry.publishedAt, entry.createdAt),
      priority: 0.62,
      url: getAbsoluteUrl(`/gallery/${entry.slug}`),
    };
  });

  const newsRoutes: MetadataRoute.Sitemap = newsEntries.map((entry) => {
    const image = getContentListThumbnailImage(entry);

    return {
      changeFrequency: "weekly",
      images: image?.src ? [getAbsoluteUrl(image.src)] : undefined,
      lastModified: readSitemapDate(entry.updatedAt, entry.publishedAt, entry.createdAt),
      priority: 0.58,
      url: getAbsoluteUrl(`/news/${entry.slug}`),
    };
  });

  return [...staticRoutes, ...productRoutes, ...galleryRoutes, ...newsRoutes];
}

function readSitemapDate(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!value) {
      continue;
    }

    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return new Date();
}
