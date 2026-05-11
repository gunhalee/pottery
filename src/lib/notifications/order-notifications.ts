import "server-only";

import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export type OrderNotificationChannel = "email" | "kakao";

export type OrderNotificationTemplate =
  | "fulfillment_delivered"
  | "fulfillment_preparing"
  | "fulfillment_shipped"
  | "order_canceled"
  | "order_received"
  | "payment_attention"
  | "payment_paid"
  | "picked_up"
  | "pickup_ready";

export type OrderNotificationRecipient = {
  email?: string | null;
  phone?: string | null;
};

export type OrderNotificationJobInput = {
  orderId: string;
  orderNumber: string;
  payload?: Record<string, unknown>;
  recipient: OrderNotificationRecipient;
  template: OrderNotificationTemplate;
};

type NotificationJobRow = {
  channel: OrderNotificationChannel;
  order_id: string;
  payload: Record<string, unknown>;
  recipient: string | null;
  template: OrderNotificationTemplate;
};

export async function enqueueOrderNotificationJobs(
  input: OrderNotificationJobInput,
) {
  if (!isSupabaseConfigured()) {
    return;
  }

  const rows = buildNotificationRows(input);

  if (rows.length === 0) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("shop_notification_jobs").insert(rows);

  if (!error) {
    return;
  }

  if (isNotificationStorageMissingError(error)) {
    console.warn(
      "shop_notification_jobs is not ready yet; notification jobs were skipped.",
    );
    return;
  }

  console.error(`Notification job enqueue failed: ${error.message}`);
}

export function templateForFulfillmentStatus(status: string) {
  return {
    canceled: "order_canceled",
    delivered: "fulfillment_delivered",
    picked_up: "picked_up",
    pickup_ready: "pickup_ready",
    preparing: "fulfillment_preparing",
    returned: "order_canceled",
    shipped: "fulfillment_shipped",
    unfulfilled: null,
  }[status] as OrderNotificationTemplate | null;
}

function buildNotificationRows(
  input: OrderNotificationJobInput,
): NotificationJobRow[] {
  const basePayload = {
    orderNumber: input.orderNumber,
    ...(input.payload ?? {}),
  };
  const rows: NotificationJobRow[] = [];

  if (input.recipient.email) {
    rows.push({
      channel: "email",
      order_id: input.orderId,
      payload: basePayload,
      recipient: input.recipient.email,
      template: input.template,
    });
  }

  if (input.recipient.phone) {
    rows.push({
      channel: "kakao",
      order_id: input.orderId,
      payload: basePayload,
      recipient: input.recipient.phone,
      template: input.template,
    });
  }

  return rows;
}

function isNotificationStorageMissingError(error: {
  code?: string;
  message?: string;
}) {
  const message = error.message ?? "";

  return (
    error.code === "42P01" ||
    message.includes("shop_notification_jobs") ||
    message.includes("schema cache")
  );
}
