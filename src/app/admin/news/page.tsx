import { redirect } from "next/navigation";
import { ContentAdminListPage } from "@/components/admin/content-admin-list-page";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { readContentEntries } from "@/lib/content-manager/content-store";

type AdminNewsPageProps = {
  searchParams: Promise<{
    deleted?: string;
    missing?: string;
    slug_error?: string;
  }>;
};

export const metadata = {
  title: "News Admin",
};

export default async function AdminNewsPage({
  searchParams,
}: AdminNewsPageProps) {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect("/admin/login?next=/admin/news");
  }

  const [params, entries] = await Promise.all([
    searchParams,
    readContentEntries("news"),
  ]);

  return (
    <ContentAdminListPage
      deleted={params.deleted}
      entries={entries}
      kind="news"
      missing={params.missing}
      slugError={params.slug_error}
    />
  );
}
