import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;
let publicClient: SupabaseClient | null = null;

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey());
}

export function isSupabasePublicReadConfigured() {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

export function getSupabaseAdminClient() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.",
    );
  }

  if (!adminClient) {
    adminClient = createClient(
      getSupabaseUrl()!,
      getSupabaseServiceRoleKey()!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return adminClient;
}

export function getSupabasePublicClient() {
  if (!isSupabasePublicReadConfigured()) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variables are required.",
    );
  }

  if (!publicClient) {
    publicClient = createClient(
      getSupabaseUrl()!,
      getSupabasePublishableKey()!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  return publicClient;
}

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function getSupabaseServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function getSupabasePublishableKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}
