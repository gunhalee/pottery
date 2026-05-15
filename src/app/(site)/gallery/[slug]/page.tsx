import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentDetailPage } from "@/components/content/content-detail-page";
import { getContentCoverImage } from "@/lib/content-manager/content-images";
import {
  getContentEntryBySlug,
  getPublishedContentSlugs,
} from "@/lib/content-manager/content-store";
import { getProductBySlug } from "@/lib/shop";
import { createPageMetadata } from "@/lib/seo/site";

type GalleryDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  const slugs = await getPublishedContentSlugs("gallery");
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: GalleryDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getContentEntryBySlug("gallery", slug);

  if (!entry) {
    return {};
  }

  return createPageMetadata({
    description: entry.summary || entry.bodyText,
    image: getContentCoverImage(entry),
    path: `/gallery/${entry.slug}`,
    title: entry.title,
  });
}

export default async function GalleryDetailPage({
  params,
}: GalleryDetailPageProps) {
  const { slug } = await params;
  const entry = await getContentEntryBySlug("gallery", slug);

  if (!entry) {
    notFound();
  }

  const relatedProduct = entry.relatedProductSlug
    ? await getProductBySlug(entry.relatedProductSlug)
    : null;

  return <ContentDetailPage entry={entry} relatedProduct={relatedProduct} />;
}
