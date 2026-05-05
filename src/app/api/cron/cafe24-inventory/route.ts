import { syncCafe24InventoryForMappedProducts } from "@/lib/cafe24/inventory-sync";
import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

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

  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json(
      {
        error: "Unauthorized",
        ok: false,
      },
      { status: 401 },
    );
  }

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

    return Response.json({
      changedSlugs,
      ok: summary.failed === 0,
      summary,
    });
  } catch (error) {
    return Response.json(
      {
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
