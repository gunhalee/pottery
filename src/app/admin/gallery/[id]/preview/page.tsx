import { notFound, redirect } from "next/navigation";
import { ContentDetailPage } from "@/components/content/content-detail-page";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { getContentEntryById } from "@/lib/content-manager/content-store";
import { getProductBySlug } from "@/lib/shop";

type AdminGalleryPreviewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const metadata = {
  title: "Preview Gallery",
};

export default async function AdminGalleryPreviewPage({
  params,
}: AdminGalleryPreviewPageProps) {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect("/admin/login?next=/admin/gallery");
  }

  const { id } = await params;
  const entry = await getContentEntryById(id);

  if (!entry || entry.kind !== "gallery") {
    notFound();
  }

  const relatedProduct = entry.relatedProductSlug
    ? await getProductBySlug(entry.relatedProductSlug)
    : null;

  return (
    <ContentDetailPage
      entry={entry}
      preview
      relatedProduct={relatedProduct}
    />
  );
}
