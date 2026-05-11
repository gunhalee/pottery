import { NextRequest } from "next/server";
import {
  failCronRun,
  finishCronRun,
  startCronRun,
} from "@/lib/ops/cron-run-log";
import { processPendingOrderNotificationJobs } from "@/lib/notifications/order-notifications";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const defaultLimit = 20;
const maxLimit = 100;
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
    namespace: "cron-order-notifications",
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

  const dryRun = request.nextUrl.searchParams.get("dryRun") !== "0";
  const skipUnconfigured =
    request.nextUrl.searchParams.get("skipUnconfigured") === "1";
  const limit = readBoundedNumber(
    request.nextUrl.searchParams.get("limit"),
    defaultLimit,
    1,
    maxLimit,
  );
  const requestSummary = {
    dryRun,
    limit,
    skipUnconfigured,
  };
  const cronRun = await startCronRun({
    jobName: "order_notifications",
    summary: requestSummary,
  });

  try {
    const summary = await processPendingOrderNotificationJobs({
      dryRun,
      limit,
      skipUnconfigured,
    });
    const runSummary = {
      request: requestSummary,
      summary,
    };

    await finishCronRun(cronRun, runSummary);

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
          error instanceof Error
            ? error.message
            : "Order notification cron failed.",
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
