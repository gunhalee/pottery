import { notFound, redirect } from "next/navigation";
import { ContentAdminEditPage } from "@/components/admin/content-admin-edit-page";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { getContentEntryById } from "@/lib/content-manager/content-store";
import { readMediaLibraryAssets } from "@/lib/media/media-store";
import { readProducts } from "@/lib/shop";

type AdminGalleryEditPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    created?: string;
    delete_error?: string;
    image_deleted?: string;
    publish_error?: string;
    saved?: string;
    slug_error?: string;
  }>;
};

export const metadata = {
  title: "Edit Gallery",
};

export default async function AdminGalleryEditPage({
  params,
  searchParams,
}: AdminGalleryEditPageProps) {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect("/admin/login?next=/admin/gallery");
  }

  const [{ id }, flags, products, mediaAssets] = await Promise.all([
    params,
    searchParams,
    readProducts(),
    readMediaLibraryAssets(120),
  ]);
  const entry = await getContentEntryById(id);

  if (!entry || entry.kind !== "gallery") {
    notFound();
  }

  return (
    <ContentAdminEditPage
      created={flags.created}
      deleteError={flags.delete_error}
      entry={entry}
      imageDeleted={flags.image_deleted}
      kind="gallery"
      mediaAssets={mediaAssets}
      productOptions={products.map((product) => ({
        slug: product.slug,
        title: product.titleKo,
      }))}
      publishError={flags.publish_error}
      saved={flags.saved}
      slugError={flags.slug_error}
    />
  );
}
