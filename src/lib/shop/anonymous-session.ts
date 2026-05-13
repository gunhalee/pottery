import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const anonymousSessionCookieName = "conse_session";
export const anonymousSessionMaxAgeSeconds = 60 * 60 * 24 * 90;

export type AnonymousSession = {
  expiresAt: string;
  id: string;
  token: string;
};

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

type AnonymousSessionRow = {
  expires_at: string;
  id: string;
};

const tokenPattern = /^[A-Za-z0-9_-]{32,160}$/;

export async function getAnonymousSessionFromRequest(
  request: NextRequest,
): Promise<AnonymousSession | null> {
  return getAnonymousSessionFromCookieValue(
    request.cookies.get(anonymousSessionCookieName)?.value,
  );
}

export async function getAnonymousSessionFromCookieStore(
  cookieStore: CookieReader,
) {
  return getAnonymousSessionFromCookieValue(
    cookieStore.get(anonymousSessionCookieName)?.value,
  );
}

export async function getAnonymousSessionFromCookieValue(
  token?: string,
): Promise<AnonymousSession | null> {
  if (!isSupabaseConfigured() || !isValidSessionToken(token)) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("anonymous_sessions")
    .select("id, expires_at")
    .eq("token_hash", hashSessionToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    if (isMissingAnonymousSessionStorageError(error)) {
      return null;
    }

    throw new Error(`Anonymous session query failed: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return fromAnonymousSessionRow(data as AnonymousSessionRow, token);
}

export async function getOrCreateAnonymousSession(
  request: NextRequest,
): Promise<{
  created: boolean;
  session: AnonymousSession;
}> {
  const existingToken = request.cookies.get(anonymousSessionCookieName)?.value;
  const existing = await getAnonymousSessionFromCookieValue(existingToken);

  if (existing) {
    const refreshed = await refreshAnonymousSession(existing);

    return {
      created: false,
      session: refreshed,
    };
  }

  return {
    created: true,
    session: await createAnonymousSession(),
  };
}

export function setAnonymousSessionCookie(
  response: NextResponse,
  session: AnonymousSession,
) {
  response.cookies.set(anonymousSessionCookieName, session.token, {
    httpOnly: true,
    maxAge: anonymousSessionMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

async function createAnonymousSession(): Promise<AnonymousSession> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase anonymous session storage is not configured.");
  }

  const token = randomBytes(48).toString("base64url");
  const expiresAt = getSessionExpiry().toISOString();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("anonymous_sessions")
    .insert({
      expires_at: expiresAt,
      token_hash: hashSessionToken(token),
    })
    .select("id, expires_at")
    .single();

  if (error) {
    throw new Error(`Anonymous session insert failed: ${error.message}`);
  }

  return fromAnonymousSessionRow(data as AnonymousSessionRow, token);
}

async function refreshAnonymousSession(
  session: AnonymousSession,
): Promise<AnonymousSession> {
  const expiresAt = getSessionExpiry().toISOString();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("anonymous_sessions")
    .update({
      expires_at: expiresAt,
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .select("id, expires_at")
    .single();

  if (error) {
    throw new Error(`Anonymous session refresh failed: ${error.message}`);
  }

  return fromAnonymousSessionRow(data as AnonymousSessionRow, session.token);
}

function fromAnonymousSessionRow(
  row: AnonymousSessionRow,
  token: string,
): AnonymousSession {
  return {
    expiresAt: row.expires_at,
    id: row.id,
    token,
  };
}

function hashSessionToken(token: string) {
  return createHmac("sha256", getSessionSecret()).update(token).digest("hex");
}

function getSessionSecret() {
  return (
    process.env.ANONYMOUS_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_SECRET_SUPABASE_SERVICE_ROLE_KEY ||
    "consepot-local-unconfigured-anonymous-session-secret"
  );
}

function getSessionExpiry() {
  return new Date(Date.now() + anonymousSessionMaxAgeSeconds * 1000);
}

function isValidSessionToken(token?: string): token is string {
  return Boolean(token && tokenPattern.test(token));
}

function isMissingAnonymousSessionStorageError(error: {
  code?: string;
  message?: string;
}) {
  const message = error.message ?? "";

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (message.includes("anonymous_sessions") &&
      (message.includes("schema cache") ||
        message.includes("does not exist") ||
        message.includes("relation")))
  );
}
