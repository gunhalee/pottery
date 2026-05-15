import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentDetailPage } from "@/components/content/content-detail-page";
import { getContentCoverImage } from "@/lib/content-manager/content-images";
import {
  getContentEntryBySlug,
  getPublishedContentSlugs,
} from "@/lib/content-manager/content-store";
import { createPageMetadata } from "@/lib/seo/site";

type NewsDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  const slugs = await getPublishedContentSlugs("news");
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: NewsDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getContentEntryBySlug("news", slug);

  if (!entry) {
    return {};
  }

  return createPageMetadata({
    description: entry.summary || entry.bodyText,
    image: getContentCoverImage(entry),
    path: `/news/${entry.slug}`,
    title: entry.title,
    type: "article",
  });
}

export default async function NewsDetailPage({ params }: NewsDetailPageProps) {
  const { slug } = await params;
  const entry = await getContentEntryBySlug("news", slug);

  if (!entry) {
    notFound();
  }

  return <ContentDetailPage entry={entry} />;
}
