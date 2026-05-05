import "server-only";

import { randomBytes } from "node:crypto";
import {
  readCafe24StoredToken,
  saveCafe24StoredToken,
} from "./token-store";

export const cafe24OAuthStateCookieName = "consepot_cafe24_oauth_state";

const defaultScopes = "mall.read_product mall.write_product";
const tokenRefreshBufferMs = 5 * 60 * 1000;

export type Cafe24TokenResponse = {
  access_token: string;
  client_id?: string;
  expires_at?: string;
  issued_at?: string;
  mall_id?: string;
  refresh_token?: string;
  refresh_token_expires_at?: string;
  scopes?: string[];
  shop_no?: number | string;
  token_type?: string;
  user_id?: string;
};

type Cafe24OAuthConfig = {
  clientId: string;
  clientSecret: string;
  mallId: string;
  scopes: string;
};

export function createCafe24OAuthState() {
  return randomBytes(18).toString("hex");
}

export function getCafe24OAuthRedirectUri(requestUrl: URL) {
  return (
    process.env.CAFE24_OAUTH_REDIRECT_URI ||
    `${requestUrl.origin}/api/cafe24/oauth/callback`
  );
}

export function buildCafe24AuthorizationUrl(options: {
  redirectUri: string;
  state: string;
}) {
  const config = getCafe24OAuthConfig();
  const url = new URL(
    `https://${config.mallId}.cafe24api.com/api/v2/oauth/authorize`,
  );

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("state", options.state);
  url.searchParams.set("redirect_uri", options.redirectUri);
  url.searchParams.set("scope", config.scopes);

  return url;
}

export async function exchangeCafe24AuthorizationCode(options: {
  code: string;
  redirectUri: string;
}) {
  const payload = await requestCafe24Token({
    code: options.code,
    grant_type: "authorization_code",
    redirect_uri: options.redirectUri,
  });

  return saveCafe24TokenResponse(payload);
}

export async function refreshCafe24AccessToken(refreshToken: string) {
  const payload = await requestCafe24Token({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  return saveCafe24TokenResponse(payload);
}

export async function getCafe24AccessToken() {
  const stored = await readCafe24StoredToken();

  if (stored?.accessToken && !shouldRefreshToken(stored.expiresAt)) {
    return stored.accessToken;
  }

  if (stored?.refreshToken) {
    const refreshed = await refreshCafe24AccessToken(stored.refreshToken);
    return refreshed.accessToken;
  }

  const envToken = process.env.CAFE24_ACCESS_TOKEN;

  if (envToken) {
    return envToken;
  }

  throw new Error("Cafe24 access token이 없습니다. OAuth 인증을 먼저 진행하세요.");
}

export async function hasCafe24AccessToken() {
  if (process.env.CAFE24_ACCESS_TOKEN) {
    return true;
  }

  const stored = await readCafe24StoredToken();
  return Boolean(stored?.accessToken);
}

export async function readCafe24TokenScopes(accessToken?: string) {
  const config = getCafe24OAuthConfig();
  const token = accessToken ?? (await getCafe24AccessToken());
  const response = await fetch(
    `https://${config.mallId}.cafe24api.com/api/v2/oauth/token/scopes`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(extractCafe24OAuthError(payload) ?? "Cafe24 scope 조회 실패");
  }

  return payload;
}

function getCafe24OAuthConfig(): Cafe24OAuthConfig {
  return {
    clientId: requiredEnv("CAFE24_CLIENT_ID"),
    clientSecret: requiredEnv("CAFE24_CLIENT_SECRET"),
    mallId: requiredEnv("CAFE24_MALL_ID"),
    scopes: process.env.CAFE24_OAUTH_SCOPES || defaultScopes,
  };
}

async function requestCafe24Token(params: Record<string, string>) {
  const config = getCafe24OAuthConfig();
  const body = new URLSearchParams(params);
  const response = await fetch(
    `https://${config.mallId}.cafe24api.com/api/v2/oauth/token`,
    {
      body,
      headers: {
        Authorization: `Basic ${basicAuth(config.clientId, config.clientSecret)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    },
  );
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(extractCafe24OAuthError(payload) ?? "Cafe24 토큰 발급 실패");
  }

  if (!isCafe24TokenResponse(payload)) {
    throw new Error("Cafe24 토큰 응답 형식을 확인하지 못했습니다.");
  }

  return payload;
}

async function saveCafe24TokenResponse(payload: Cafe24TokenResponse) {
  const config = getCafe24OAuthConfig();

  return saveCafe24StoredToken({
    accessToken: payload.access_token,
    expiresAt: normalizeCafe24Date(payload.expires_at),
    mallId: payload.mall_id ?? config.mallId,
    rawResponse: redactCafe24TokenResponse(payload),
    refreshToken: payload.refresh_token ?? null,
    refreshTokenExpiresAt: normalizeCafe24Date(payload.refresh_token_expires_at),
    scopes: payload.scopes ?? [],
    tokenType: payload.token_type ?? "Bearer",
  });
}

function shouldRefreshToken(expiresAt: string | null) {
  if (!expiresAt) {
    return false;
  }

  return new Date(expiresAt).getTime() - Date.now() < tokenRefreshBufferMs;
}

function normalizeCafe24Date(value: string | undefined) {
  if (!value) {
    return null;
  }

  const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value);
  const date = new Date(hasTimezone ? value : `${value}+09:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function basicAuth(clientId: string, clientSecret: string) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} 환경 변수가 필요합니다.`);
  }

  return value;
}

async function readJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isCafe24TokenResponse(value: unknown): value is Cafe24TokenResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "access_token" in value &&
    typeof value.access_token === "string"
  );
}

function extractCafe24OAuthError(payload: unknown) {
  if (typeof payload === "string") {
    return payload;
  }

  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  if ("error_description" in payload) {
    return String(payload.error_description);
  }

  if ("message" in payload) {
    return String(payload.message);
  }

  if ("error" in payload) {
    return String(payload.error);
  }

  return null;
}

function redactCafe24TokenResponse(payload: Cafe24TokenResponse) {
  return {
    ...payload,
    access_token: payload.access_token ? "[redacted]" : undefined,
    refresh_token: payload.refresh_token ? "[redacted]" : undefined,
  };
}
