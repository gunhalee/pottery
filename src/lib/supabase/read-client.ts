import "server-only";

import {
  getSupabaseAdminClient,
  getSupabasePublicClient,
  isSupabasePublicReadConfigured,
} from "./server";

export function getSupabasePublicReadClient() {
  return isSupabasePublicReadConfigured()
    ? getSupabasePublicClient()
    : getSupabaseAdminClient();
}
