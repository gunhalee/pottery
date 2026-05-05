import { notFound } from "next/navigation";
import { ContentDetailPage } from "@/components/content/content-detail-page";
import {
  getContentEntryBySlug,
  getPublishedContentSlugs,
} from "@/lib/content-manager/content-store";

type NewsDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  const slugs = await getPublishedContentSlugs("news");
  return slugs.map((slug) => ({ slug }));
}

export default async function NewsDetailPage({ params }: NewsDetailPageProps) {
  const { slug } = await params;
  const entry = await getContentEntryBySlug("news", slug);

  if (!entry) {
    notFound();
  }

  return <ContentDetailPage entry={entry} />;
}
