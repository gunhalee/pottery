import { notFound } from "next/navigation";
import { ContentDetailPage } from "@/components/content/content-detail-page";
import {
  getContentEntryBySlug,
  getPublishedContentSlugs,
} from "@/lib/content-manager/content-store";
import { getProductBySlug } from "@/lib/shop";

type GalleryDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  const slugs = await getPublishedContentSlugs("gallery");
  return slugs.map((slug) => ({ slug }));
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
