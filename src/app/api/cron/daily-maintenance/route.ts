import { cancelExpiredVirtualAccountOrders } from "@/lib/orders/virtual-account";
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
import { cleanupOrphanUploads } from "@/lib/uploads/orphan-cleanup";
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
    namespace: "cron-daily-maintenance",
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
  const cleanupMinAgeHours = readOptionalBoundedNumber(
    request.nextUrl.searchParams.get("cleanupMinAgeHours"),
    1,
    24 * 30,
  );
  const cleanupAbandonedIntentMinAgeHours = readBoundedNumber(
    request.nextUrl.searchParams.get("cleanupAbandonedIntentMinAgeHours"),
    cleanupMinAgeHours ?? defaultAbandonedIntentMinAgeHours,
    1,
    24 * 30,
  );
  const cleanupStorageOrphanMinAgeHours = readBoundedNumber(
    request.nextUrl.searchParams.get("cleanupStorageOrphanMinAgeHours"),
    cleanupMinAgeHours ?? defaultStorageOrphanMinAgeHours,
    1,
    24 * 30,
  );
  const cleanupUnreferencedAssetMinAgeHours = readBoundedNumber(
    request.nextUrl.searchParams.get("cleanupUnreferencedAssetMinAgeHours"),
    cleanupMinAgeHours ?? defaultUnreferencedAssetMinAgeHours,
    1,
    24 * 30,
  );
  const cleanupMaxDeletes = readBoundedNumber(
    request.nextUrl.searchParams.get("cleanupMaxDeletes"),
    defaultMaxDeletes,
    1,
    maxDeletesLimit,
  );
  const requestSummary = {
    cleanupAbandonedIntentMinAgeHours,
    cleanupMaxDeletes,
    cleanupStorageOrphanMinAgeHours,
    cleanupUnreferencedAssetMinAgeHours,
    dryRun,
  };
  const cronRun = await startCronRun({
    jobName: "daily_maintenance",
    summary: requestSummary,
  });

  try {
    const virtualAccountExpiry = await cancelExpiredVirtualAccountOrders();
    const uploadCleanup = await cleanupOrphanUploads({
      abandonedIntentMinAgeHours: cleanupAbandonedIntentMinAgeHours,
      dryRun,
      maxDeletesPerRun: cleanupMaxDeletes,
      storageOrphanMinAgeHours: cleanupStorageOrphanMinAgeHours,
      unreferencedAssetMinAgeHours: cleanupUnreferencedAssetMinAgeHours,
    });
    const summary = {
      request: requestSummary,
      uploadCleanup,
      virtualAccountExpiry,
    };

    if (uploadCleanup.failed > 0) {
      await failCronRun(
        cronRun,
        new Error(
          `Daily maintenance completed with ${uploadCleanup.failed} upload cleanup failures.`,
        ),
        summary,
      );
    } else {
      await finishCronRun(cronRun, summary);
    }

    return Response.json({
      cronRunId: cronRun.id,
      ok: uploadCleanup.failed === 0,
      summary,
    });
  } catch (error) {
    await failCronRun(cronRun, error, requestSummary);

    return Response.json(
      {
        cronRunId: cronRun.id,
        error:
          error instanceof Error ? error.message : "Daily maintenance failed.",
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
