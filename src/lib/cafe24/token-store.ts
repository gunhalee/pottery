import "server-only";

import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

const tokenRowId = "default";

export type Cafe24StoredToken = {
  accessToken: string;
  expiresAt: string | null;
  mallId: string;
  refreshToken: string | null;
  refreshTokenExpiresAt: string | null;
  scopes: string[];
  tokenType: string;
};

type Cafe24TokenRow = {
  access_token: string;
  expires_at: string | null;
  mall_id: string;
  refresh_token: string | null;
  refresh_token_expires_at: string | null;
  scopes: string[] | null;
  token_type: string;
};

export type Cafe24StoredTokenInput = {
  accessToken: string;
  expiresAt?: string | null;
  mallId: string;
  rawResponse?: unknown;
  refreshToken?: string | null;
  refreshTokenExpiresAt?: string | null;
  scopes?: string[];
  tokenType?: string;
};

export async function readCafe24StoredToken() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cafe24_oauth_tokens")
    .select("*")
    .eq("id", tokenRowId)
    .maybeSingle();

  if (error) {
    if (isMissingTokenTableError(error)) {
      return null;
    }

    throw new Error(`Cafe24 토큰 조회 실패: ${error.message}`);
  }

  return data ? fromTokenRow(data as Cafe24TokenRow) : null;
}

export async function saveCafe24StoredToken(input: Cafe24StoredTokenInput) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 연결이 필요합니다.");
  }

  const current = await readCafe24StoredToken();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cafe24_oauth_tokens")
    .upsert(
      {
        access_token: input.accessToken,
        expires_at: input.expiresAt ?? null,
        id: tokenRowId,
        mall_id: input.mallId,
        raw_response: input.rawResponse ?? null,
        refresh_token: input.refreshToken ?? current?.refreshToken ?? null,
        refresh_token_expires_at:
          input.refreshTokenExpiresAt ?? current?.refreshTokenExpiresAt ?? null,
        scopes: input.scopes ?? current?.scopes ?? [],
        token_type: input.tokenType ?? current?.tokenType ?? "Bearer",
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();

  if (error) {
    if (isMissingTokenTableError(error)) {
      throw new Error(
        "Cafe24 토큰 테이블이 없습니다. Supabase migration을 먼저 적용해 주세요.",
      );
    }

    throw new Error(`Cafe24 토큰 저장 실패: ${error.message}`);
  }

  return fromTokenRow(data as Cafe24TokenRow);
}

function isMissingTokenTableError(error: { code?: string; message?: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    Boolean(error.message?.includes("cafe24_oauth_tokens"))
  );
}

function fromTokenRow(row: Cafe24TokenRow): Cafe24StoredToken {
  return {
    accessToken: row.access_token,
    expiresAt: row.expires_at,
    mallId: row.mall_id,
    refreshToken: row.refresh_token,
    refreshTokenExpiresAt: row.refresh_token_expires_at,
    scopes: row.scopes ?? [],
    tokenType: row.token_type,
  };
}
