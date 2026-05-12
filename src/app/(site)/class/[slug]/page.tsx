import { redirect } from "next/navigation";
import { siteConfig } from "@/lib/config/site";

type ClassDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ClassDetailPage({
  params,
}: ClassDetailPageProps) {
  await params;
  redirect(siteConfig.naverReservationUrl);
}
