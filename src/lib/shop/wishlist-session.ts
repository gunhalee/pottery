import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const wishlistCookieName = "consepot_wishlist";
export const wishlistCookieMaxAgeSeconds = 60 * 60 * 24 * 365;

const wishlistCookieSubject = "wishlist";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createWishlistCookieValue(wishlistId: string) {
  const payload = `${wishlistCookieSubject}.${wishlistId}`;
  return `${payload}.${sign(payload)}`;
}

export function readWishlistIdFromCookieValue(value?: string) {
  if (!value) {
    return null;
  }

  const [subject, wishlistId, signature] = value.split(".");

  if (
    subject !== wishlistCookieSubject ||
    !wishlistId ||
    !uuidPattern.test(wishlistId) ||
    !signature
  ) {
    return null;
  }

  const payload = `${subject}.${wishlistId}`;

  if (!safeCompare(signature, sign(payload))) {
    return null;
  }

  return wishlistId;
}

function sign(payload: string) {
  return createHmac("sha256", getWishlistSecret()).update(payload).digest("hex");
}

function getWishlistSecret() {
  return (
    process.env.WISHLIST_COOKIE_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_SECRET_SUPABASE_SERVICE_ROLE_KEY ||
    "consepot-local-unconfigured-wishlist-secret"
  );
}

function safeCompare(a: string, b: string) {
  const first = Buffer.from(a);
  const second = Buffer.from(b);

  if (first.length !== second.length) {
    return false;
  }

  return timingSafeEqual(first, second);
}
