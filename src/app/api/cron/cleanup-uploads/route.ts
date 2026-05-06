import { cleanupOrphanUploads } from "@/lib/uploads/orphan-cleanup";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const defaultMinAgeHours = 48;
const defaultMaxDeletes = 100;
const maxDeletesLimit = 500;

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
  const minAgeHours = readBoundedNumber(
    request.nextUrl.searchParams.get("minAgeHours"),
    defaultMinAgeHours,
    1,
    24 * 30,
  );
  const maxDeletesPerRun = readBoundedNumber(
    request.nextUrl.searchParams.get("maxDeletes"),
    defaultMaxDeletes,
    1,
    maxDeletesLimit,
  );

  try {
    const summary = await cleanupOrphanUploads({
      dryRun,
      maxDeletesPerRun,
      minAgeHours,
    });

    return Response.json({
      ok: summary.failed === 0,
      summary,
    });
  } catch (error) {
    return Response.json(
      {
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
