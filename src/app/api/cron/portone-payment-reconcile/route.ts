import { NextRequest } from "next/server";

import type { PaymentStatus } from "@/lib/orders/order-model";
import {
  failCronRun,
  finishCronRun,
  startCronRun,
} from "@/lib/ops/cron-run-log";
import { syncPortOnePayment } from "@/lib/payments";
import {
  consumeRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const defaultLimit = 5;
const maxLimit = 10;
const defaultConcurrency = 1;
const maxConcurrency = 2;
const defaultOlderThanMinutes = 60;
const maxOlderThanMinutes = 60 * 24;
const cronRateLimit = {
  limit: 20,
  windowMs: 10 * 60_000,
};

type PendingPaymentRow = {
  id: string;
  order_number: string;
  payment_status: PaymentStatus;
  portone_payment_id: string;
  updated_at: string;
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
    namespace: "cron-portone-payment-reconcile",
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

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const limit = readBoundedNumber(
    request.nextUrl.searchParams.get("limit"),
    defaultLimit,
    1,
    maxLimit,
  );
  const olderThanMinutes = readBoundedNumber(
    request.nextUrl.searchParams.get("olderThanMinutes"),
    defaultOlderThanMinutes,
    1,
    maxOlderThanMinutes,
  );
  const concurrency = readBoundedNumber(
    request.nextUrl.searchParams.get("concurrency"),
    defaultConcurrency,
    1,
    maxConcurrency,
  );
  const requestSummary = {
    concurrency,
    dryRun,
    limit,
    olderThanMinutes,
  };
  const cronRun = await startCronRun({
    jobName: "portone_payment_reconcile",
    summary: requestSummary,
  });

  try {
    const rows = await readPendingPortOnePayments({
      limit,
      olderThanMinutes,
    });
    const results = dryRun
      ? rows.map((row) => ({
          orderId: row.id,
          orderNumber: row.order_number,
          paymentId: row.portone_payment_id,
          status: "dry_run",
        }))
      : await mapWithConcurrency(rows, concurrency, syncPendingPayment);

    const summary = {
      failed: results.filter((result) => result.status === "failed").length,
      results,
      scanned: rows.length,
      synced: results.filter((result) => result.status === "synced").length,
    };

    if (summary.failed > 0) {
      await failCronRun(
        cronRun,
        new Error(
          `PortOne payment reconcile completed with ${summary.failed} failures.`,
        ),
        {
          request: requestSummary,
          summary,
        },
      );
    } else {
      await finishCronRun(cronRun, {
        request: requestSummary,
        summary,
      });
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
            : "PortOne payment reconcile failed.",
        ok: false,
      },
      { status: 500 },
    );
  }
}

async function readPendingPortOnePayments({
  limit,
  olderThanMinutes,
}: {
  limit: number;
  olderThanMinutes: number;
}) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_orders")
    .select("id, order_number, payment_status, portone_payment_id, updated_at")
    .eq("payment_status", "pending")
    .not("portone_payment_id", "is", null)
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as unknown as PendingPaymentRow[];
}

async function syncPendingPayment(row: PendingPaymentRow) {
  try {
    const synced = await syncPortOnePayment({
      orderId: row.id,
      paymentId: row.portone_payment_id,
      source: "cron",
    });
    return {
      orderId: row.id,
      orderNumber: synced.orderNumber,
      paymentId: synced.paymentId,
      paymentStatus: synced.paymentStatus,
      status: "synced",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      orderId: row.id,
      orderNumber: row.order_number,
      paymentId: row.portone_payment_id,
      status: "failed",
    };
  }
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<U>,
) {
  const results = new Array<U>(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
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
