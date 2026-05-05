import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  buildCafe24AuthorizationUrl,
  cafe24OAuthStateCookieName,
  createCafe24OAuthState,
  getCafe24OAuthRedirectUri,
} from "@/lib/cafe24/oauth";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.redirect(
      new URL("/admin/login?next=/api/cafe24/oauth/start", request.url),
    );
  }

  const state = createCafe24OAuthState();
  const redirectUri = getCafe24OAuthRedirectUri(request.nextUrl);
  const authorizationUrl = buildCafe24AuthorizationUrl({
    redirectUri,
    state,
  });
  const response = NextResponse.redirect(authorizationUrl);

  response.cookies.set(cafe24OAuthStateCookieName, state, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
