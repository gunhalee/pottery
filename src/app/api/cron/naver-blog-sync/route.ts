import { revalidateTag } from "next/cache";
import { NextRequest } from "next/server";
import { publicCacheTags } from "@/lib/cache/public-cache-tags";
import {
  getConfiguredNaverBlogId,
  getConfiguredNaverBlogSyncLimit,
  normalizeNaverBlogId,
} from "@/lib/naver-blog/naver-blog-config";
import { syncNaverBlogPosts } from "@/lib/naver-blog/naver-blog-sync";
import {
  failCronRun,
  finishCronRun,
  startCronRun,
} from "@/lib/ops/cron-run-log";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const maxLimit = 50;
const cronRateLimit = {
  limit: 20,
  windowMs: 10 * 60_000,
};

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret) {
    return Response.json(
      {
        error: "CRON_SECRET is required.",
        ok: false,
      },
      { status: 500 },
    );
  }

  const rateLimit = await consumeRateLimit({
    key: getClientIp(request.headers),
    limit: cronRateLimit.limit,
    namespace: "cron-naver-blog-sync",
    windowMs: cronRateLimit.windowMs,
  });

  if (!rateLimit.allowed) {
    return Response.json(
      {
        error: "Too many cron requests.",
        ok: false,
      },
      {
        headers: rateLimitHeaders(rateLimit),
        status: 429,
      },
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json(
      {
        error: "Unauthorized",
        ok: false,
      },
      { status: 401 },
    );
  }

  if (!isSupabaseConfigured()) {
    return Response.json(
      {
        error: "Supabase is not configured.",
        ok: false,
      },
      { status: 503 },
    );
  }

  const blogId = normalizeNaverBlogId(
    request.nextUrl.searchParams.get("blogId") ?? getConfiguredNaverBlogId(),
  );

  if (!blogId) {
    return Response.json(
      {
        error: "NAVER_BLOG_ID is required.",
        ok: false,
      },
      { status: 503 },
    );
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const limit = readBoundedNumber(
    request.nextUrl.searchParams.get("limit"),
    getConfiguredNaverBlogSyncLimit(),
    1,
    maxLimit,
  );
  const requestSummary = {
    blogId,
    dryRun,
    limit,
  };
  const cronRun = await startCronRun({
    jobName: "naver_blog_sync",
    summary: requestSummary,
  });

  try {
    const summary = await syncNaverBlogPosts({
      blogId,
      dryRun,
      limit,
    });

    if (!dryRun && (summary.inserted > 0 || summary.updated > 0)) {
      revalidateTag(publicCacheTags.naverBlog, "max");
    }

    await finishCronRun(cronRun, {
      request: requestSummary,
      summary,
    });

    return Response.json({
      cronRunId: cronRun.id,
      ok: true,
      summary,
    });
  } catch (error) {
    await failCronRun(cronRun, error, requestSummary);

    return Response.json(
      {
        cronRunId: cronRun.id,
        error:
          error instanceof Error ? error.message : "Naver blog sync failed.",
        ok: false,
      },
      { status: 500 },
    );
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
