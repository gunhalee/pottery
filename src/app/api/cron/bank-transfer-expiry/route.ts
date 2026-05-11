import { NextResponse } from "next/server";
import { cancelExpiredBankTransferOrders } from "@/lib/orders/bank-transfer";
import {
  failCronRun,
  finishCronRun,
  startCronRun,
} from "@/lib/ops/cron-run-log";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cronRun = await startCronRun({
    jobName: "bank_transfer_expiry",
    triggerSource: "http",
  });

  try {
    const summary = await cancelExpiredBankTransferOrders();
    await finishCronRun(cronRun, summary);

    return NextResponse.json(summary, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    await failCronRun(cronRun, error);
    throw error;
  }
}
