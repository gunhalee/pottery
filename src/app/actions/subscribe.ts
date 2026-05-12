"use server";

import { redirect } from "next/navigation";
import { siteConfig } from "@/lib/config/site";

export async function subscribeNewsletter() {
  redirect(siteConfig.kakaoChannelUrl);
}
