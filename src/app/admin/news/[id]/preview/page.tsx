import { notFound, redirect } from "next/navigation";
import { ContentDetailPage } from "@/components/content/content-detail-page";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { getContentEntryById } from "@/lib/content-manager/content-store";

type AdminNewsPreviewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const metadata = {
  title: "Preview News",
};

export default async function AdminNewsPreviewPage({
  params,
}: AdminNewsPreviewPageProps) {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect("/admin/login?next=/admin/news");
  }

  const { id } = await params;
  const entry = await getContentEntryById(id);

  if (!entry || entry.kind !== "news") {
    notFound();
  }

  return <ContentDetailPage entry={entry} preview />;
}
