import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type YouTubeChannelListResponse = {
  error?: YouTubeApiError;
  items?: YouTubeChannelItem[];
};

type YouTubePlaylistItemsResponse = {
  error?: YouTubeApiError;
  items?: YouTubePlaylistItem[];
};

type YouTubeApiError = {
  code?: number;
  message?: string;
};

type YouTubeChannelItem = {
  contentDetails?: {
    relatedPlaylists?: {
      uploads?: string;
    };
  };
  id?: string;
};

type YouTubePlaylistItem = {
  contentDetails?: {
    videoId?: string;
    videoPublishedAt?: string;
  };
  id?: string;
  snippet?: {
    description?: string;
    publishedAt?: string;
    resourceId?: {
      videoId?: string;
    };
    thumbnails?: Record<string, YouTubeThumbnail | undefined>;
    title?: string;
  };
};

type YouTubeThumbnail = {
  height?: number;
  url?: string;
  width?: number;
};

type YouTubeFetchResult<TPayload> = {
  ok: boolean;
  payload: TPayload;
  status: number;
};

type ResolveUploadsPlaylistResult =
  | {
      playlistId: string;
      status: "found";
    }
  | {
      result: YouTubeFetchResult<YouTubeChannelListResponse>;
      status: "error";
    }
  | {
      status: "not_found";
    };

const defaultLimit = 3;
const maxLimit = 12;
const defaultRequestReferer = "https://consepot.com/";
const youtubeApiBaseUrl = "https://www.googleapis.com/youtube/v3";

export async function GET(request: Request) {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json(
      {
        items: [],
        ok: false,
        reason: "youtube_not_configured",
      },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const requestReferer = getYouTubeRequestReferer();
  const limit = readBoundedNumber(
    url.searchParams.get("limit"),
    readBoundedNumber(process.env.YOUTUBE_FEED_LIMIT ?? null, defaultLimit, 1, maxLimit),
    1,
    maxLimit,
  );
  const playlistId = process.env.YOUTUBE_UPLOADS_PLAYLIST_ID?.trim();
  const resolvedUploadsPlaylist = playlistId
    ? ({ playlistId, status: "found" } satisfies ResolveUploadsPlaylistResult)
    : await resolveUploadsPlaylistId(apiKey, requestReferer);

  if (resolvedUploadsPlaylist.status === "error") {
    return createYouTubeErrorResponse(resolvedUploadsPlaylist.result);
  }

  if (resolvedUploadsPlaylist.status === "not_found") {
    return NextResponse.json(
      {
        items: [],
        ok: false,
        reason: "youtube_channel_not_found",
      },
      { status: 404 },
    );
  }

  const uploadsPlaylistId = resolvedUploadsPlaylist.playlistId;
  const playlistResult = await fetchYouTubeJson<YouTubePlaylistItemsResponse>(
    "playlistItems",
    {
      maxResults: String(limit),
      part: "snippet,contentDetails",
      playlistId: uploadsPlaylistId,
    },
    apiKey,
    requestReferer,
  );

  if (!playlistResult.ok) {
    return createYouTubeErrorResponse(playlistResult);
  }

  return NextResponse.json(
    {
      items: (playlistResult.payload.items ?? [])
        .map(normalizePlaylistItem)
        .filter(Boolean),
      ok: true,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}

async function resolveUploadsPlaylistId(
  apiKey: string,
  requestReferer: string | null,
): Promise<ResolveUploadsPlaylistResult> {
  const channelId = process.env.YOUTUBE_CHANNEL_ID?.trim();

  if (channelId) {
    const result = await fetchChannelById(apiKey, channelId, requestReferer);

    if (!result.ok) {
      return {
        result,
        status: "error",
      };
    }

    const playlistId = getUploadsPlaylistId(result.payload.items?.[0] ?? null);

    return playlistId
      ? {
          playlistId,
          status: "found",
        }
      : {
          status: "not_found",
        };
  }

  const handle = process.env.YOUTUBE_CHANNEL_HANDLE?.trim() || "@consepot";
  const handleCandidates = getHandleCandidates(handle);

  for (const handleCandidate of handleCandidates) {
    const result = await fetchChannelByHandle(apiKey, handleCandidate, requestReferer);

    if (!result.ok) {
      return {
        result,
        status: "error",
      };
    }

    const uploadsPlaylistId = getUploadsPlaylistId(
      result.payload.items?.[0] ?? null,
    );

    if (uploadsPlaylistId) {
      return {
        playlistId: uploadsPlaylistId,
        status: "found",
      };
    }
  }

  return {
    status: "not_found",
  };
}

async function fetchChannelById(
  apiKey: string,
  channelId: string,
  requestReferer: string | null,
) {
  const result = await fetchYouTubeJson<YouTubeChannelListResponse>(
    "channels",
    {
      id: channelId,
      part: "contentDetails",
    },
    apiKey,
    requestReferer,
  );

  return result;
}

async function fetchChannelByHandle(
  apiKey: string,
  handle: string,
  requestReferer: string | null,
) {
  const result = await fetchYouTubeJson<YouTubeChannelListResponse>(
    "channels",
    {
      forHandle: handle,
      part: "contentDetails",
    },
    apiKey,
    requestReferer,
  );

  return result;
}

async function fetchYouTubeJson<TPayload>(
  endpoint: string,
  params: Record<string, string>,
  apiKey: string,
  requestReferer: string | null,
): Promise<YouTubeFetchResult<TPayload>> {
  const url = new URL(`${youtubeApiBaseUrl}/${endpoint}`);
  const headers = new Headers({
    Accept: "application/json",
  });

  url.searchParams.set("key", apiKey);
  if (requestReferer) {
    headers.set("Referer", requestReferer);
  }

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers,
    next: {
      revalidate: 3600,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as TPayload;

  return {
    ok: response.ok,
    payload,
    status: response.status,
  };
}

function createYouTubeErrorResponse<TPayload extends { error?: YouTubeApiError }>(
  result: YouTubeFetchResult<TPayload>,
) {
  return NextResponse.json(
    {
      error:
        result.payload.error?.message ?? "YouTube feed request failed.",
      items: [],
      ok: false,
    },
    { status: result.status >= 400 ? result.status : 502 },
  );
}

function normalizePlaylistItem(item: YouTubePlaylistItem) {
  const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;

  if (!videoId) {
    return null;
  }

  const thumbnail = selectThumbnail(item.snippet?.thumbnails);

  return {
    description: item.snippet?.description ?? null,
    id: item.id ?? videoId,
    publishedAt:
      item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt ?? null,
    thumbnail,
    title: item.snippet?.title ?? "YouTube video",
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    videoId,
  };
}

function selectThumbnail(
  thumbnails: Record<string, YouTubeThumbnail | undefined> | undefined,
) {
  const thumbnail =
    thumbnails?.maxres ??
    thumbnails?.standard ??
    thumbnails?.high ??
    thumbnails?.medium ??
    thumbnails?.default ??
    null;

  if (!thumbnail?.url) {
    return null;
  }

  return {
    height: thumbnail.height ?? null,
    url: thumbnail.url,
    width: thumbnail.width ?? null,
  };
}

function getUploadsPlaylistId(channel: YouTubeChannelItem | null) {
  return channel?.contentDetails?.relatedPlaylists?.uploads ?? null;
}

function getHandleCandidates(handle: string) {
  const trimmed = handle.trim();
  const withoutAt = trimmed.replace(/^@/, "");
  const candidates = [withoutAt, trimmed].filter(Boolean);

  return [...new Set(candidates)];
}

function getYouTubeRequestReferer() {
  const explicitReferer = normalizeReferer(process.env.YOUTUBE_REQUEST_REFERER);

  if (explicitReferer) {
    return explicitReferer;
  }

  return defaultRequestReferer;
}

function normalizeReferer(value: string | null | undefined) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);

    return `${url.protocol}//${url.host}/`;
  } catch {
    return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  }
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
