import { redirect } from "next/navigation";
import { ContentAdminListPage } from "@/components/admin/content-admin-list-page";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { readContentEntries } from "@/lib/content-manager/content-store";

type AdminGalleryPageProps = {
  searchParams: Promise<{
    deleted?: string;
    missing?: string;
    slug_error?: string;
  }>;
};

export const metadata = {
  title: "Gallery Admin",
};

export default async function AdminGalleryPage({
  searchParams,
}: AdminGalleryPageProps) {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect("/admin/login?next=/admin/gallery");
  }

  const [params, entries] = await Promise.all([
    searchParams,
    readContentEntries("gallery"),
  ]);

  return (
    <ContentAdminListPage
      deleted={params.deleted}
      entries={entries}
      kind="gallery"
      missing={params.missing}
      slugError={params.slug_error}
    />
  );
}
