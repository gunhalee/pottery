import "server-only";

import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type {
  CashReceiptIdentifierType,
  CashReceiptStatus,
  CashReceiptType,
} from "@/lib/orders/order-model";

type CashReceiptOrderRow = {
  cash_receipt_identifier_masked: string | null;
  cash_receipt_identifier_type: CashReceiptIdentifierType | null;
  cash_receipt_requested: boolean;
  cash_receipt_status: CashReceiptStatus;
  cash_receipt_type: Exclude<CashReceiptType, "none"> | null;
  id: string;
  order_number: string;
  payment_status: string;
  total_krw: number;
};

export type CashReceiptIssueResult =
  | { status: "skipped"; reason: string }
  | { status: "pending" }
  | { status: "issued"; approvalNumber: string };

export async function requestCashReceiptIssueForOrder(
  orderId: string,
): Promise<CashReceiptIssueResult> {
  if (!isSupabaseConfigured()) {
    return { reason: "supabase_unconfigured", status: "skipped" };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_orders")
    .select(
      [
        "id",
        "order_number",
        "payment_status",
        "total_krw",
        "cash_receipt_requested",
        "cash_receipt_type",
        "cash_receipt_identifier_type",
        "cash_receipt_identifier_masked",
        "cash_receipt_status",
      ].join(", "),
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) {
    return { reason: error?.message ?? "order_not_found", status: "skipped" };
  }

  const order = data as unknown as CashReceiptOrderRow;

  if (
    !order.cash_receipt_requested ||
    !order.cash_receipt_type ||
    !order.cash_receipt_identifier_type ||
    !order.cash_receipt_identifier_masked
  ) {
    return { reason: "not_requested", status: "skipped" };
  }

  if (order.payment_status !== "paid") {
    return { reason: "payment_not_paid", status: "skipped" };
  }

  if (order.cash_receipt_status === "issued") {
    return { approvalNumber: "", status: "issued" };
  }

  const existing = await supabase
    .from("shop_cash_receipts")
    .select("id, status, approval_number")
    .eq("order_id", order.id)
    .in("status", ["pending", "issued"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.data?.status === "issued") {
    return {
      approvalNumber: String(existing.data.approval_number ?? ""),
      status: "issued",
    };
  }

  if (!existing.data) {
    const credentialsReady = Boolean(
      process.env.NTS_CASH_RECEIPT_API_BASE_URL &&
        process.env.NTS_CASH_RECEIPT_API_KEY,
    );
    const { error: receiptError } = await supabase
      .from("shop_cash_receipts")
      .insert({
        amount_krw: order.total_krw,
        error_message: credentialsReady
          ? null
          : "국세청 현금영수증 API 인증 정보가 아직 설정되지 않았습니다.",
        identifier_masked: order.cash_receipt_identifier_masked,
        identifier_type: order.cash_receipt_identifier_type,
        order_id: order.id,
        raw_payload: {
          credentialsReady,
          orderNumber: order.order_number,
        },
        receipt_type: order.cash_receipt_type,
        status: "pending",
      });

    if (receiptError) {
      await supabase
        .from("shop_orders")
        .update({ cash_receipt_status: "failed" })
        .eq("id", order.id);
      return { reason: receiptError.message, status: "skipped" };
    }
  }

  await supabase
    .from("shop_orders")
    .update({
      cash_receipt_requested_at: new Date().toISOString(),
      cash_receipt_status: "pending",
    })
    .eq("id", order.id);
  await supabase.from("shop_order_events").insert({
    actor: "system",
    event_type: "cash_receipt_issue_pending",
    order_id: order.id,
    payload: {
      provider: "nts",
      reason: "pending_api_credentials",
    },
  });

  return { status: "pending" };
}
