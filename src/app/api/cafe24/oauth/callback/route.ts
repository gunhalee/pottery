import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  cafe24OAuthStateCookieName,
  exchangeCafe24AuthorizationCode,
  getCafe24OAuthRedirectUri,
  readCafe24TokenScopes,
} from "@/lib/cafe24/oauth";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = request.cookies.get(cafe24OAuthStateCookieName)?.value;

  if (error) {
    return renderCafe24OAuthResult({
      status: "error",
      title: "Cafe24 인증이 취소되었거나 실패했습니다.",
      message: errorDescription ?? error,
    });
  }

  if (!(await isAdminAuthenticated())) {
    return renderCafe24OAuthResult({
      status: "error",
      title: "관리자 로그인이 필요합니다.",
      message: "다시 로그인한 뒤 Cafe24 인증을 처음부터 시작해 주세요.",
    });
  }

  if (!code) {
    return renderCafe24OAuthResult({
      status: "error",
      title: "인증 code가 없습니다.",
      message: "Cafe24 인증을 처음부터 다시 시작해 주세요.",
    });
  }

  if (!state || !storedState || state !== storedState) {
    return renderCafe24OAuthResult({
      clearState: true,
      status: "error",
      title: "인증 state가 일치하지 않습니다.",
      message: "브라우저에서 /api/cafe24/oauth/start를 다시 열어 주세요.",
    });
  }

  try {
    const redirectUri = getCafe24OAuthRedirectUri(url);
    const token = await exchangeCafe24AuthorizationCode({
      code,
      redirectUri,
    });
    const scopes = await readCafe24TokenScopes(token.accessToken).catch(
      () => null,
    );

    return renderCafe24OAuthResult({
      clearState: true,
      detail: {
        expiresAt: token.expiresAt,
        mallId: token.mallId,
        refreshTokenExpiresAt: token.refreshTokenExpiresAt,
        scopes,
      },
      status: "success",
      title: "Cafe24 인증을 저장했습니다.",
      message: "이제 관리자 상품 상세에서 Cafe24 동기화를 실행할 수 있습니다.",
    });
  } catch (caught) {
    const message =
      caught instanceof Error
        ? caught.message
        : "Cafe24 토큰 저장 중 알 수 없는 오류가 발생했습니다.";

    return renderCafe24OAuthResult({
      clearState: true,
      status: "error",
      title: "Cafe24 토큰 발급에 실패했습니다.",
      message,
    });
  }
}

function renderCafe24OAuthResult(options: {
  clearState?: boolean;
  detail?: unknown;
  message: string;
  status: "error" | "success";
  title: string;
}) {
  const response = new NextResponse(
    `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.title)}</title>
    <style>
      body {
        margin: 0;
        background: #f7f7f5;
        color: #2d2925;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        display: grid;
        min-height: 100svh;
        place-items: center;
        padding: 32px;
      }
      section {
        width: min(100%, 520px);
        border: 1px solid #ded8ce;
        background: #fff;
        padding: 32px;
      }
      p {
        color: #686158;
        line-height: 1.7;
      }
      pre {
        overflow: auto;
        background: #f1eee8;
        padding: 16px;
        white-space: pre-wrap;
      }
      a {
        color: #2d2925;
      }
    </style>
  </head>
  <body>
    <main>
      <section>
        <p>${options.status === "success" ? "SUCCESS" : "ERROR"}</p>
        <h1>${escapeHtml(options.title)}</h1>
        <p>${escapeHtml(options.message)}</p>
        ${
          options.detail
            ? `<pre>${escapeHtml(JSON.stringify(options.detail, null, 2))}</pre>`
            : ""
        }
        <p><a href="/admin/products">관리자 상품 목록으로 이동</a></p>
      </section>
    </main>
  </body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
      status: options.status === "success" ? 200 : 400,
    },
  );

  if (options.clearState) {
    response.cookies.delete(cafe24OAuthStateCookieName);
  }

  return response;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
