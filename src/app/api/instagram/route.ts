import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type InstagramMediaResponse = {
  data?: InstagramMediaRow[];
  error?: {
    message?: string;
  };
};

type InstagramAccountResponse = {
  error?: {
    message?: string;
  };
  id?: string;
  instagram_business_account?: {
    id?: string;
    username?: string;
  };
};

type InstagramAccountsResponse = {
  data?: Array<{
    id: string;
    instagram_business_account?: {
      id?: string;
      username?: string;
    };
    name?: string;
  }>;
  error?: {
    message?: string;
  };
};

type InstagramMediaRow = {
  caption?: string;
  children?: {
    data?: InstagramMediaChildRow[];
  };
  id: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  thumbnail_url?: string;
  timestamp?: string;
  username?: string;
};

type InstagramMediaChildRow = {
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
};

type GraphFetchResult<TPayload> = {
  ok: boolean;
  payload: TPayload;
  status: number;
};

type ResolveInstagramUserResult =
  | {
      ok: true;
      userId: string;
    }
  | {
      ok: false;
      payload: InstagramAccountResponse | InstagramAccountsResponse;
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
    "children{media_type,media_url,thumbnail_url}",
    "media_type",
    "media_url",
    "permalink",
    "thumbnail_url",
    "timestamp",
    "username",
  ].join(",");

  const instagramLoginMediaResult = await fetchInstagramLoginMedia({
    accessToken,
    apiVersion,
    fields,
    limit,
    userId,
  });

  if (instagramLoginMediaResult.ok) {
    return createMediaResponse(instagramLoginMediaResult.payload);
  }

  const mediaResult = await fetchInstagramMedia({
    accessToken,
    apiVersion,
    fields,
    limit,
    userId,
  });

  if (mediaResult.ok) {
    return createMediaResponse(mediaResult.payload);
  }

  if (isPageMediaEdgeError(mediaResult.payload)) {
    const resolvedUser = await resolveInstagramBusinessUser({
      accessToken,
      apiVersion,
      configuredId: userId,
    });

    if (resolvedUser.ok) {
      const resolvedMediaResult = await fetchInstagramMedia({
        accessToken,
        apiVersion,
        fields,
        limit,
        userId: resolvedUser.userId,
      });

      if (resolvedMediaResult.ok) {
        return createMediaResponse(resolvedMediaResult.payload);
      }

      return createErrorResponse(resolvedMediaResult.payload);
    }

    return createErrorResponse(resolvedUser.payload);
  }

  return createErrorResponse(mediaResult.payload);
}

async function fetchInstagramLoginMedia({
  accessToken,
  apiVersion,
  fields,
  limit,
  userId,
}: {
  accessToken: string;
  apiVersion: string;
  fields: string;
  limit: number;
  userId: string;
}) {
  const graphUrl = new URL(
    `https://graph.instagram.com/${apiVersion}/${encodeURIComponent(userId)}/media`,
  );

  graphUrl.searchParams.set("access_token", accessToken);
  graphUrl.searchParams.set("fields", fields);
  graphUrl.searchParams.set("limit", String(limit));

  return fetchGraphJson<InstagramMediaResponse>(graphUrl);
}

async function resolveInstagramBusinessUser({
  accessToken,
  apiVersion,
  configuredId,
}: {
  accessToken: string;
  apiVersion: string;
  configuredId: string;
}): Promise<ResolveInstagramUserResult> {
  const pageAccountResult = await fetchInstagramAccountFromPage({
    accessToken,
    apiVersion,
    pageId: configuredId,
  });
  const pageIgUserId =
    pageAccountResult.payload.instagram_business_account?.id;

  if (pageAccountResult.ok && pageIgUserId) {
    return {
      ok: true,
      userId: pageIgUserId,
    };
  }

  const accountsResult = await fetchInstagramAccounts({
    accessToken,
    apiVersion,
  });
  const firstConnectedAccount = accountsResult.payload.data?.find((page) =>
    Boolean(page.instagram_business_account?.id),
  );
  const accountIgUserId =
    firstConnectedAccount?.instagram_business_account?.id;

  if (accountsResult.ok && accountIgUserId) {
    return {
      ok: true,
      userId: accountIgUserId,
    };
  }

  return {
    ok: false,
    payload: accountsResult.ok
      ? {
          error: {
            message:
              "Instagram Business Account could not be resolved from the configured ID or /me/accounts.",
          },
        }
      : accountsResult.payload,
  };
}

async function fetchInstagramMedia({
  accessToken,
  apiVersion,
  fields,
  limit,
  userId,
}: {
  accessToken: string;
  apiVersion: string;
  fields: string;
  limit: number;
  userId: string;
}) {
  const graphUrl = new URL(
    `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(userId)}/media`,
  );

  graphUrl.searchParams.set("access_token", accessToken);
  graphUrl.searchParams.set("fields", fields);
  graphUrl.searchParams.set("limit", String(limit));

  return fetchGraphJson<InstagramMediaResponse>(graphUrl);
}

async function fetchInstagramAccountFromPage({
  accessToken,
  apiVersion,
  pageId,
}: {
  accessToken: string;
  apiVersion: string;
  pageId: string;
}) {
  const graphUrl = new URL(
    `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(pageId)}`,
  );

  graphUrl.searchParams.set("access_token", accessToken);
  graphUrl.searchParams.set(
    "fields",
    "instagram_business_account{id,username}",
  );

  return fetchGraphJson<InstagramAccountResponse>(graphUrl);
}

async function fetchInstagramAccounts({
  accessToken,
  apiVersion,
}: {
  accessToken: string;
  apiVersion: string;
}) {
  const graphUrl = new URL(`https://graph.facebook.com/${apiVersion}/me/accounts`);

  graphUrl.searchParams.set("access_token", accessToken);
  graphUrl.searchParams.set(
    "fields",
    "id,name,instagram_business_account{id,username}",
  );
  graphUrl.searchParams.set("limit", "25");

  return fetchGraphJson<InstagramAccountsResponse>(graphUrl);
}

async function fetchGraphJson<TPayload>(
  url: URL,
): Promise<GraphFetchResult<TPayload>> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    next: {
      revalidate: 300,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as TPayload;

  return {
    ok: response.ok,
    payload,
    status: response.status,
  };
}

function createMediaResponse(payload: InstagramMediaResponse) {
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

function createErrorResponse(
  payload:
    | InstagramAccountResponse
    | InstagramAccountsResponse
    | InstagramMediaResponse,
) {
  return NextResponse.json(
    {
      error: payload.error?.message ?? "Instagram feed request failed.",
      items: [],
      ok: false,
    },
    { status: 502 },
  );
}

function normalizeMediaRow(row: InstagramMediaRow) {
  const childImage = getFirstChildImage(row);
  const thumbnailUrl = row.thumbnail_url ?? row.media_url ?? childImage ?? null;

  return {
    caption: row.caption ?? null,
    id: row.id,
    mediaType: row.media_type ?? "UNKNOWN",
    mediaUrl: row.media_url ?? null,
    permalink: row.permalink ?? null,
    thumbnailUrl,
    timestamp: row.timestamp ?? null,
    username: row.username ?? null,
  };
}

function getFirstChildImage(row: InstagramMediaRow) {
  return (
    row.children?.data
      ?.map((child) => child.thumbnail_url ?? child.media_url ?? null)
      .find((src) => Boolean(src)) ?? null
  );
}

function isPageMediaEdgeError(payload: InstagramMediaResponse) {
  const message = payload.error?.message ?? "";

  return message.includes("nonexisting field (media)");
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
