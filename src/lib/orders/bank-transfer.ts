import "server-only";

import { commerceConfig } from "@/lib/config/commerce";
import { enqueueOrderNotificationJobs } from "@/lib/notifications/order-notifications";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { BankTransferAccount } from "./order-model";

type ExpirableBankTransferOrderRow = {
  deposit_due_at: string | null;
  id: string;
  order_number: string;
  orderer_email: string | null;
  orderer_phone: string | null;
  total_krw: number;
};

export function getBankTransferAccount(): BankTransferAccount {
  return commerceConfig.bankTransfer;
}

export function getDepositDueAt(now = new Date()) {
  return new Date(
    now.getTime() + commerceConfig.bankTransfer.depositDueHours * 60 * 60_000,
  );
}

export async function cancelExpiredBankTransferOrders(limit = 50) {
  const summary = {
    canceled: 0,
    checked: 0,
    failed: 0,
  };

  if (!isSupabaseConfigured()) {
    return summary;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_orders")
    .select(
      "id, order_number, orderer_email, orderer_phone, total_krw, deposit_due_at",
    )
    .eq("payment_method", "bank_transfer")
    .eq("payment_status", "pending")
    .lte("deposit_due_at", new Date().toISOString())
    .order("deposit_due_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Expired bank-transfer orders could not be read: ${error.message}`);
  }

  const orders = (data ?? []) as ExpirableBankTransferOrderRow[];
  summary.checked = orders.length;

  for (const order of orders) {
    const { data: canceled, error: cancelError } = await supabase.rpc(
      "cancel_expired_bank_transfer_order",
      {
        p_order_id: order.id,
      },
    );

    if (cancelError) {
      summary.failed += 1;
      continue;
    }

    if (canceled) {
      summary.canceled += 1;
      await enqueueOrderNotificationJobs({
        orderId: order.id,
        orderNumber: order.order_number,
        payload: {
          depositDueAt: order.deposit_due_at,
          total: order.total_krw,
        },
        recipient: {
          email: order.orderer_email,
          phone: order.orderer_phone,
        },
        template: "deposit_expired",
      });
    }
  }

  return summary;
}
