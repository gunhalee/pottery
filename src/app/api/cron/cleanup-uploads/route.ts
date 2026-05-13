import { cleanupOrphanUploads } from "@/lib/uploads/orphan-cleanup";
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
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const defaultAbandonedIntentMinAgeHours = 12;
const defaultStorageOrphanMinAgeHours = 24;
const defaultUnreferencedAssetMinAgeHours = 48;
const defaultMaxDeletes = 100;
const maxDeletesLimit = 500;
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
    namespace: "cron-cleanup-uploads",
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

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const minAgeHours = readOptionalBoundedNumber(
    request.nextUrl.searchParams.get("minAgeHours"),
    1,
    24 * 30,
  );
  const abandonedIntentMinAgeHours = readBoundedNumber(
    request.nextUrl.searchParams.get("abandonedIntentMinAgeHours"),
    minAgeHours ?? defaultAbandonedIntentMinAgeHours,
    1,
    24 * 30,
  );
  const storageOrphanMinAgeHours = readBoundedNumber(
    request.nextUrl.searchParams.get("storageOrphanMinAgeHours"),
    minAgeHours ?? defaultStorageOrphanMinAgeHours,
    1,
    24 * 30,
  );
  const unreferencedAssetMinAgeHours = readBoundedNumber(
    request.nextUrl.searchParams.get("unreferencedAssetMinAgeHours"),
    minAgeHours ?? defaultUnreferencedAssetMinAgeHours,
    1,
    24 * 30,
  );
  const maxDeletesPerRun = readBoundedNumber(
    request.nextUrl.searchParams.get("maxDeletes"),
    defaultMaxDeletes,
    1,
    maxDeletesLimit,
  );
  const requestSummary = {
    abandonedIntentMinAgeHours,
    dryRun,
    maxDeletesPerRun,
    storageOrphanMinAgeHours,
    unreferencedAssetMinAgeHours,
  };
  const cronRun = await startCronRun({
    jobName: "upload_cleanup",
    summary: requestSummary,
  });

  try {
    const summary = await cleanupOrphanUploads({
      abandonedIntentMinAgeHours,
      dryRun,
      maxDeletesPerRun,
      storageOrphanMinAgeHours,
      unreferencedAssetMinAgeHours,
    });

    const runSummary = {
      request: requestSummary,
      summary,
    };

    if (summary.failed > 0) {
      await failCronRun(
        cronRun,
        new Error(`Upload cleanup completed with ${summary.failed} failures.`),
        runSummary,
      );
    } else {
      await finishCronRun(cronRun, runSummary);
    }

    return Response.json({
      cronRunId: cronRun.id,
      ok: summary.failed === 0,
      summary,
    });
  } catch (error) {
    await failCronRun(cronRun, error, requestSummary);

    return Response.json(
      {
        cronRunId: cronRun.id,
        error:
          error instanceof Error
            ? error.message
            : "Upload cleanup cron failed.",
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

function readOptionalBoundedNumber(
  value: string | null,
  min: number,
  max: number,
) {
  if (!value) {
    return undefined;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return undefined;
  }

  return Math.min(max, Math.max(min, Math.floor(numberValue)));
}
