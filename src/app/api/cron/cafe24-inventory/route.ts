import { syncCafe24InventoryForMappedProducts } from "@/lib/cafe24/inventory-sync";
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
import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

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
        error: "CRON_SECRET 환경 변수가 필요합니다.",
        ok: false,
      },
      { status: 500 },
    );
  }

  const rateLimit = await consumeRateLimit({
    key: getClientIp(request.headers),
    limit: cronRateLimit.limit,
    namespace: "cron-cafe24-inventory",
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

  const cronRun = await startCronRun({ jobName: "cafe24_inventory" });

  try {
    const summary = await syncCafe24InventoryForMappedProducts();
    const changedSlugs = summary.results
      .filter((result) => result.status === "updated")
      .map((result) => result.slug);

    if (changedSlugs.length > 0) {
      revalidatePath("/shop");

      for (const slug of changedSlugs) {
        revalidatePath(`/shop/${slug}`);
      }
    }

    const runSummary = {
      changedSlugs,
      summary,
    };

    if (summary.failed > 0) {
      await failCronRun(
        cronRun,
        new Error(`Cafe24 inventory sync completed with ${summary.failed} failures.`),
        runSummary,
      );
    } else {
      await finishCronRun(cronRun, runSummary);
    }

    return Response.json({
      changedSlugs,
      cronRunId: cronRun.id,
      ok: summary.failed === 0,
      summary,
    });
  } catch (error) {
    await failCronRun(cronRun, error);

    return Response.json(
      {
        cronRunId: cronRun.id,
        error:
          error instanceof Error
            ? error.message
            : "Cafe24 재고 cron 동기화 중 알 수 없는 오류가 발생했습니다.",
        ok: false,
      },
      { status: 500 },
    );
  }
}
