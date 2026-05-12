import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type InstagramMediaResponse = {
  data?: InstagramMediaRow[];
  error?: {
    message?: string;
  };
};

type InstagramMediaRow = {
  caption?: string;
  id: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  thumbnail_url?: string;
  timestamp?: string;
  username?: string;
};

const defaultLimit = 9;
const maxLimit = 24;

export async function GET(request: Request) {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const userId = process.env.INSTAGRAM_USER_ID?.trim();

  if (!accessToken || !userId) {
    return NextResponse.json(
      {
        items: [],
        ok: false,
        reason: "instagram_not_configured",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const limit = readBoundedNumber(
    url.searchParams.get("limit"),
    defaultLimit,
    1,
    maxLimit,
  );
  const apiVersion = (
    process.env.INSTAGRAM_API_VERSION?.trim() || "v24.0"
  ).replace(/^\/+|\/+$/g, "");
  const fields = [
    "id",
    "caption",
    "media_type",
    "media_url",
    "permalink",
    "thumbnail_url",
    "timestamp",
    "username",
  ].join(",");
  const graphUrl = new URL(
    `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(userId)}/media`,
  );

  graphUrl.searchParams.set("access_token", accessToken);
  graphUrl.searchParams.set("fields", fields);
  graphUrl.searchParams.set("limit", String(limit));

  const response = await fetch(graphUrl, {
    headers: {
      Accept: "application/json",
    },
    next: {
      revalidate: 300,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as InstagramMediaResponse;

  if (!response.ok) {
    return NextResponse.json(
      {
        error: payload.error?.message ?? "Instagram feed request failed.",
        items: [],
        ok: false,
      },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      items: (payload.data ?? []).map(normalizeMediaRow),
      ok: true,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800",
      },
    },
  );
}

function normalizeMediaRow(row: InstagramMediaRow) {
  return {
    caption: row.caption ?? null,
    id: row.id,
    mediaType: row.media_type ?? "UNKNOWN",
    mediaUrl: row.media_url ?? null,
    permalink: row.permalink ?? null,
    thumbnailUrl: row.thumbnail_url ?? row.media_url ?? null,
    timestamp: row.timestamp ?? null,
    username: row.username ?? null,
  };
}

function readBoundedNumber(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  if (!value) {
    return fallback;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.floor(numberValue)));
}
