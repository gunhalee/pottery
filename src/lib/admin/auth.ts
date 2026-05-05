import "server-only";

import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const cookieName = "consepot_admin_session";
const sessionDurationMs = 12 * 60 * 60 * 1000;

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const value = cookieStore.get(cookieName)?.value;

  if (!value) {
    return false;
  }

  return verifySessionCookie(value);
}

export async function assertAdmin() {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    throw new Error("관리자 인증이 필요합니다.");
  }
}

export async function setAdminSessionCookie() {
  const cookieStore = await cookies();
  const value = createSessionCookieValue();

  cookieStore.set(cookieName, value, {
    httpOnly: true,
    maxAge: Math.floor(sessionDurationMs / 1000),
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export function verifyAdminPassword(password: string) {
  const expectedPassword = process.env.ADMIN_PASSWORD;
  const expectedHash = process.env.ADMIN_PASSWORD_SHA256;

  if (expectedHash) {
    return safeCompare(sha256(password), expectedHash.trim().toLowerCase());
  }

  if (!expectedPassword) {
    return false;
  }

  return safeCompare(sha256(password), sha256(expectedPassword));
}

export function isAdminPasswordConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD_SHA256);
}

function createSessionCookieValue() {
  const expiresAt = Date.now() + sessionDurationMs;
  const payload = `admin.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function verifySessionCookie(value: string) {
  const [subject, expiresAtRaw, signature] = value.split(".");

  if (subject !== "admin" || !expiresAtRaw || !signature) {
    return false;
  }

  const expiresAt = Number(expiresAtRaw);

  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return false;
  }

  return safeCompare(signature, sign(`${subject}.${expiresAtRaw}`));
}

function sign(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("hex");
}

function getSessionSecret() {
  const secret =
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD_SHA256;

  if (!secret) {
    return "consepot-local-unconfigured-admin-secret";
  }

  return secret;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeCompare(a: string, b: string) {
  const first = Buffer.from(a);
  const second = Buffer.from(b);

  if (first.length !== second.length) {
    return false;
  }

  return timingSafeEqual(first, second);
}
