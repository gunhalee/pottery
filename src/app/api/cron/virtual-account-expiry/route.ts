import { NextResponse } from "next/server";
import { cancelExpiredVirtualAccountOrders } from "@/lib/orders/virtual-account";
import { failCronRun, finishCronRun, startCronRun } from "@/lib/ops/cron-run-log";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = await startCronRun({
    jobName: "virtual_account_expiry",
    triggerSource: "vercel-cron",
  });

  try {
    const summary = await cancelExpiredVirtualAccountOrders();
    await finishCronRun(run, summary);

    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    await failCronRun(run, error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Virtual account expiry failed",
      },
      { status: 500 },
    );
  }
}
