"use server";

import { redirect } from "next/navigation";
import { siteConfig } from "@/lib/config/site";

export async function createReservationDraft() {
  redirect(siteConfig.naverReservationUrl);
}
