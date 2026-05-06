import { notFound, redirect } from "next/navigation";
import { ContentAdminEditPage } from "@/components/admin/content-admin-edit-page";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { getContentEntryById } from "@/lib/content-manager/content-store";
import { readMediaLibraryAssets } from "@/lib/media/media-store";

type AdminNewsEditPageProps = {
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
  title: "Edit News",
};

export default async function AdminNewsEditPage({
  params,
  searchParams,
}: AdminNewsEditPageProps) {
  const [{ id }, flags] = await Promise.all([params, searchParams]);
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect(`/admin/login?next=${encodeURIComponent(`/admin/news/${id}`)}`);
  }

  const [entry, mediaAssets] = await Promise.all([
    getContentEntryById(id),
    readMediaLibraryAssets(120),
  ]);

  if (!entry || entry.kind !== "news") {
    notFound();
  }

  return (
    <ContentAdminEditPage
      created={flags.created}
      deleteError={flags.delete_error}
      entry={entry}
      imageDeleted={flags.image_deleted}
      kind="news"
      mediaAssets={mediaAssets}
      publishError={flags.publish_error}
      saved={flags.saved}
      slugError={flags.slug_error}
    />
  );
}
