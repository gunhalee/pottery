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
  created_at?: string;
  id?: string;
  order_id: string;
  payload: Record<string, unknown>;
  recipient: string | null;
  template: OrderNotificationTemplate;
};

export type ProcessOrderNotificationJobsSummary = {
  dryRun: boolean;
  failed: number;
  pending: number;
  processed: number;
  skipped: number;
  unconfigured: number;
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

export async function processPendingOrderNotificationJobs({
  dryRun = true,
  limit = 20,
  skipUnconfigured = false,
}: {
  dryRun?: boolean;
  limit?: number;
  skipUnconfigured?: boolean;
} = {}): Promise<ProcessOrderNotificationJobsSummary> {
  const summary: ProcessOrderNotificationJobsSummary = {
    dryRun,
    failed: 0,
    pending: 0,
    processed: 0,
    skipped: 0,
    unconfigured: 0,
  };

  if (!isSupabaseConfigured()) {
    return summary;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_notification_jobs")
    .select("id, order_id, channel, template, recipient, payload, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    if (isNotificationStorageMissingError(error)) {
      return summary;
    }

    throw new Error(`Notification jobs could not be read: ${error.message}`);
  }

  const jobs = (data ?? []) as Required<NotificationJobRow>[];
  summary.pending = jobs.length;

  for (const job of jobs) {
    if (dryRun) {
      continue;
    }

    const unconfiguredMessage = getUnconfiguredProviderMessage(job.channel);

    if (unconfiguredMessage) {
      summary.unconfigured += 1;

      if (skipUnconfigured) {
        await markNotificationJob(job.id, {
          errorMessage: unconfiguredMessage,
          status: "skipped",
        });
        summary.processed += 1;
        summary.skipped += 1;
      }

      continue;
    }

    // Provider adapters are intentionally explicit. Once an email or Kakao
    // sender is connected, call it here and mark the job as sent/failed.
    summary.unconfigured += 1;
  }

  return summary;
}

async function markNotificationJob(
  id: string,
  {
    errorMessage,
    status,
  }: {
    errorMessage: string | null;
    status: "failed" | "sent" | "skipped";
  },
) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("shop_notification_jobs")
    .update({
      error_message: errorMessage,
      sent_at: status === "sent" ? now : null,
      status,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Notification job update failed: ${error.message}`);
  }
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

function getUnconfiguredProviderMessage(channel: OrderNotificationChannel) {
  if (channel === "email") {
    return "Email provider is not configured.";
  }

  return "Kakao Alimtalk provider is not configured.";
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
