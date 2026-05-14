import "server-only";

import type { NextResponse } from "next/server";

export const checkoutRecoveryCookieName = "conse_checkout_recovery";

export type CheckoutRecoveryCookie = {
  attemptId: string;
  orderId: string;
  token: string;
};

type CheckoutRecoveryCookieInput = {
  checkoutAttemptId?: string;
  orderId?: string;
  recoveryToken?: string;
  recoveryTokenExpiresAt?: string | null;
};

const maxCheckoutRecoveryCookieAgeSeconds = 24 * 60 * 60;

export function readCheckoutRecoveryCookie(
  request: Request,
): CheckoutRecoveryCookie | null {
  const raw = readCookieValue(
    request.headers.get("cookie"),
    checkoutRecoveryCookieName,
  );

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as Partial<CheckoutRecoveryCookie>;

    if (
      !isValidCookieText(parsed.attemptId) ||
      !isValidCookieText(parsed.orderId) ||
      !isValidCookieText(parsed.token)
    ) {
      return null;
    }

    return {
      attemptId: parsed.attemptId,
      orderId: parsed.orderId,
      token: parsed.token,
    };
  } catch {
    return null;
  }
}

export function setCheckoutRecoveryCookie(
  response: NextResponse,
  input: CheckoutRecoveryCookieInput,
) {
  if (!input.checkoutAttemptId || !input.orderId || !input.recoveryToken) {
    return;
  }

  response.cookies.set(
    checkoutRecoveryCookieName,
    Buffer.from(
      JSON.stringify({
        attemptId: input.checkoutAttemptId,
        orderId: input.orderId,
        token: input.recoveryToken,
      } satisfies CheckoutRecoveryCookie),
      "utf8",
    ).toString("base64url"),
    {
      httpOnly: true,
      maxAge: getCookieMaxAge(input.recoveryTokenExpiresAt),
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  );
}

export function clearCheckoutRecoveryCookie(response: NextResponse) {
  response.cookies.set(checkoutRecoveryCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

function getCookieMaxAge(expiresAt: string | null | undefined) {
  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : NaN;

  if (!Number.isFinite(expiresAtMs)) {
    return maxCheckoutRecoveryCookieAgeSeconds;
  }

  return Math.max(
    1,
    Math.min(
      maxCheckoutRecoveryCookieAgeSeconds,
      Math.ceil((expiresAtMs - Date.now()) / 1000),
    ),
  );
}

function readCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...valueParts] = part.trim().split("=");

    if (rawName === name) {
      return decodeCookieValue(valueParts.join("="));
    }
  }

  return null;
}

function decodeCookieValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isValidCookieText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 240;
}
