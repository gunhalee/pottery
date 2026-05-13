import "server-only";

import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export type OrderNotificationChannel = "email" | "kakao";

export type OrderNotificationTemplate =
  | "admin_class_review_consent_received"
  | "admin_class_review_received"
  | "admin_feedback_received"
  | "admin_fulfillment_shipped"
  | "admin_gift_address_submitted"
  | "admin_order_received"
  | "admin_payment_paid"
  | "admin_return_request_received"
  | "admin_return_request_received_kakao"
  | "deposit_expired"
  | "deposit_guide"
  | "deposit_reminder"
  | "fulfillment_delivered"
  | "fulfillment_preparing"
  | "fulfillment_shipped"
  | "gift_address_request"
  | "gift_address_submitted"
  | "made_to_order_confirmed"
  | "made_to_order_delay"
  | "order_canceled"
  | "order_received"
  | "payment_attention"
  | "payment_paid"
  | "picked_up"
  | "pickup_ready"
  | "return_request_confirmation"
  | "return_request_confirmation_kakao";

export type OrderNotificationRecipient = {
  email?: string | null;
  phone?: string | null;
};

export type OrderNotificationJobInput = {
  orderId?: string | null;
  orderNumber: string;
  payload?: Record<string, unknown>;
  recipient: OrderNotificationRecipient;
  template: OrderNotificationTemplate;
};

export type AdminNotificationJobInput = {
  orderId?: string | null;
  orderNumber?: string;
  payload?: Record<string, unknown>;
  template: Extract<
    OrderNotificationTemplate,
    | "admin_class_review_received"
    | "admin_feedback_received"
    | "admin_fulfillment_shipped"
    | "admin_gift_address_submitted"
    | "admin_order_received"
    | "admin_payment_paid"
    | "admin_return_request_received"
    | "admin_return_request_received_kakao"
    | "admin_class_review_consent_received"
  >;
};

type NotificationJobRow = {
  channel: OrderNotificationChannel;
  created_at?: string;
  id?: string;
  order_id: string | null;
  payload: Record<string, unknown>;
  recipient: string | null;
  template: OrderNotificationTemplate;
};

type PendingNotificationJob = Required<
  Pick<NotificationJobRow, "channel" | "created_at" | "id" | "payload" | "recipient" | "template">
> & {
  order_id: string | null;
};

type NotificationSendResult =
  | {
      status: "sent";
    }
  | {
      errorMessage: string;
      status: "skipped" | "unconfigured";
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

  await insertNotificationRows(rows);
}

export async function enqueueAdminNotificationJob(
  input: AdminNotificationJobInput,
) {
  if (!isSupabaseConfigured()) {
    return;
  }

  const recipient = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();

  if (!recipient) {
    return;
  }

  await insertNotificationRows([
    {
      channel: "email",
      order_id: input.orderId ?? null,
      payload: {
        orderNumber: input.orderNumber ?? null,
        ...(input.payload ?? {}),
      },
      recipient,
      template: input.template,
    },
  ]);
}

export async function enqueueAdminKakaoNotificationJob(
  input: AdminNotificationJobInput,
) {
  if (!isSupabaseConfigured()) {
    return;
  }

  const recipient = process.env.ADMIN_NOTIFICATION_PHONE?.trim();

  if (!recipient) {
    return;
  }

  await insertNotificationRows([
    {
      channel: "kakao",
      order_id: input.orderId ?? null,
      payload: {
        orderNumber: input.orderNumber ?? null,
        ...(input.payload ?? {}),
      },
      recipient,
      template: input.template,
    },
  ]);
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

  const jobs = (data ?? []) as PendingNotificationJob[];
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

    try {
      const result = await sendNotificationJob(job);

      if (result.status === "unconfigured") {
        summary.unconfigured += 1;

        if (skipUnconfigured) {
          await markNotificationJob(job.id, {
            errorMessage: result.errorMessage,
            status: "skipped",
          });
          summary.processed += 1;
          summary.skipped += 1;
        }

        continue;
      }

      await markNotificationJob(job.id, {
        errorMessage: result.status === "skipped" ? result.errorMessage : null,
        status: result.status,
      });
      summary.processed += 1;

      if (result.status === "skipped") {
        summary.skipped += 1;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Notification send failed.";

      await markNotificationJob(job.id, {
        errorMessage: message,
        status: "failed",
      });
      summary.failed += 1;
      summary.processed += 1;
    }
  }

  return summary;
}

async function insertNotificationRows(rows: NotificationJobRow[]) {
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

async function sendNotificationJob(
  job: PendingNotificationJob,
): Promise<NotificationSendResult> {
  if (!job.recipient) {
    return {
      errorMessage: "Notification recipient is empty.",
      status: "skipped",
    };
  }

  if (job.channel === "email") {
    return sendResendEmail(job);
  }

  return sendKakaoAlimtalk(job);
}

async function sendResendEmail(
  job: PendingNotificationJob,
): Promise<NotificationSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !from) {
    return {
      errorMessage: "Resend API key or sender is not configured.",
      status: "unconfigured",
    };
  }

  const content = buildNotificationContent(job);
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL?.trim();
  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from,
      html: content.html,
      reply_to: replyTo || undefined,
      subject: content.subject,
      text: content.text,
      to: job.recipient,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Resend send failed: ${await response.text()}`);
  }

  return { status: "sent" };
}

async function sendKakaoAlimtalk(
  job: PendingNotificationJob,
): Promise<NotificationSendResult> {
  const apiUrl = process.env.KAKAO_NOTIFICATION_API_URL?.trim();
  const apiKey = process.env.KAKAO_NOTIFICATION_API_KEY?.trim();
  const provider = process.env.KAKAO_NOTIFICATION_PROVIDER?.trim();
  const senderKey = process.env.KAKAO_NOTIFICATION_SENDER_KEY?.trim();

  if (!apiUrl || !apiKey || !provider || !senderKey) {
    return {
      errorMessage: "Kakao Alimtalk provider settings are not configured.",
      status: "unconfigured",
    };
  }

  const content = buildNotificationContent(job);
  const response = await fetch(apiUrl, {
    body: JSON.stringify({
      message: content.text,
      payload: job.payload,
      provider,
      recipient: job.recipient,
      senderKey,
      template: job.template,
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Kakao Alimtalk send failed: ${await response.text()}`);
  }

  return { status: "sent" };
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
      order_id: input.orderId ?? null,
      payload: basePayload,
      recipient: input.recipient.email,
      template: input.template,
    });
  }

  if (input.recipient.phone) {
    rows.push({
      channel: "kakao",
      order_id: input.orderId ?? null,
      payload: basePayload,
      recipient: input.recipient.phone,
      template: input.template,
    });
  }

  return rows;
}

function getUnconfiguredProviderMessage(channel: OrderNotificationChannel) {
  if (channel === "email") {
    if (!process.env.RESEND_API_KEY?.trim()) {
      return "RESEND_API_KEY is not configured.";
    }

    if (!process.env.RESEND_FROM_EMAIL?.trim()) {
      return "RESEND_FROM_EMAIL is not configured.";
    }

    return null;
  }

  if (!process.env.KAKAO_NOTIFICATION_PROVIDER?.trim()) {
    return "KAKAO_NOTIFICATION_PROVIDER is not configured.";
  }

  if (!process.env.KAKAO_NOTIFICATION_API_URL?.trim()) {
    return "KAKAO_NOTIFICATION_API_URL is not configured.";
  }

  if (!process.env.KAKAO_NOTIFICATION_API_KEY?.trim()) {
    return "KAKAO_NOTIFICATION_API_KEY is not configured.";
  }

  if (!process.env.KAKAO_NOTIFICATION_SENDER_KEY?.trim()) {
    return "KAKAO_NOTIFICATION_SENDER_KEY is not configured.";
  }

  return null;
}

function buildNotificationContent(job: PendingNotificationJob) {
  const orderNumber = stringPayload(job.payload.orderNumber) ?? "주문";
  const total = numberPayload(job.payload.total);
  const totalText = total === null ? null : formatCurrency(total);
  const title = titleForTemplate(job.template, orderNumber);
  const lines = [
    title,
    `주문번호: ${orderNumber}`,
    totalText ? `금액: ${totalText}` : null,
    stringPayload(job.payload.productTitle)
      ? `상품: ${stringPayload(job.payload.productTitle)}`
      : null,
    stringPayload(job.payload.reviewBody)
      ? `후기: ${stringPayload(job.payload.reviewBody)}`
      : null,
    stringPayload(job.payload.authorName)
      ? `작성자: ${stringPayload(job.payload.authorName)}`
      : null,
    numberPayload(job.payload.rating) !== null
      ? `평점: ${numberPayload(job.payload.rating)}점`
      : null,
    stringPayload(job.payload.trackingNumber)
      ? `운송장: ${stringPayload(job.payload.trackingNumber)}`
      : null,
    stringPayload(job.payload.trackingUrl)
      ? `배송조회: ${stringPayload(job.payload.trackingUrl)}`
      : null,
    stringPayload(job.payload.actionUrl)
      ? `확인 링크: ${stringPayload(job.payload.actionUrl)}`
      : null,
    stringPayload(job.payload.requestType)
      ? `요청 유형: ${stringPayload(job.payload.requestType)}`
      : null,
    stringPayload(job.payload.reason)
      ? `사유: ${stringPayload(job.payload.reason)}`
      : null,
    stringPayload(job.payload.customerContact)
      ? `연락처: ${stringPayload(job.payload.customerContact)}`
      : null,
    stringPayload(job.payload.recipientName)
      ? `수령인: ${stringPayload(job.payload.recipientName)}`
      : null,
    stringPayload(job.payload.participantName)
      ? `참여자: ${stringPayload(job.payload.participantName)}`
      : null,
    stringPayload(job.payload.classTitle)
      ? `클래스: ${stringPayload(job.payload.classTitle)}`
      : null,
    stringPayload(job.payload.displayName)
      ? `표시명: ${stringPayload(job.payload.displayName)}`
      : null,
    stringPayload(job.payload.consentScope)
      ? `동의 범위: ${stringPayload(job.payload.consentScope)}`
      : null,
    stringPayload(job.payload.depositDueAt)
      ? `입금기한: ${formatDateTime(stringPayload(job.payload.depositDueAt))}`
      : null,
    "자세한 내용은 관리자 화면 또는 주문 조회에서 확인해 주세요.",
  ].filter(Boolean) as string[];

  return {
    html: `<div>${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>`,
    subject: title,
    text: lines.join("\n"),
  };
}

function titleForTemplate(template: OrderNotificationTemplate, orderNumber: string) {
  return {
    admin_class_review_consent_received: "[관리자] 클래스 후기/사진 동의가 접수되었습니다",
    admin_class_review_received: "[관리자] 새 클래스 후기가 접수되었습니다",
    admin_feedback_received: "[관리자] 새 구매평이 접수되었습니다",
    admin_fulfillment_shipped: `[관리자] 배송 시작 알림 ${orderNumber}`,
    admin_gift_address_submitted: `[관리자] 선물 배송지가 입력되었습니다 ${orderNumber}`,
    admin_order_received: `[관리자] 새 주문 접수 ${orderNumber}`,
    admin_payment_paid: `[관리자] 결제 확인 ${orderNumber}`,
    admin_return_request_received: `[관리자] 교환·반품 문의가 접수되었습니다 ${orderNumber}`,
    admin_return_request_received_kakao: `[관리자] 교환·반품 문의가 접수되었습니다 ${orderNumber}`,
    deposit_expired: `입금 기한이 만료되었습니다 ${orderNumber}`,
    deposit_guide: `가상계좌가 발급되었습니다 ${orderNumber}`,
    deposit_reminder: `입금 기한을 확인해 주세요 ${orderNumber}`,
    fulfillment_delivered: `배송이 완료되었습니다 ${orderNumber}`,
    fulfillment_preparing: `배송 준비가 시작되었습니다 ${orderNumber}`,
    fulfillment_shipped: `배송이 시작되었습니다 ${orderNumber}`,
    gift_address_request: `선물 배송 정보를 입력해 주세요 ${orderNumber}`,
    gift_address_submitted: `선물 배송 정보가 입력되었습니다 ${orderNumber}`,
    made_to_order_confirmed: `주문 제작 일정이 확정되었습니다 ${orderNumber}`,
    made_to_order_delay: `주문 제작 일정 안내 ${orderNumber}`,
    order_canceled: `주문 상태가 변경되었습니다 ${orderNumber}`,
    order_received: `주문이 접수되었습니다 ${orderNumber}`,
    payment_attention: `결제 확인 안내 ${orderNumber}`,
    payment_paid: `결제가 확인되었습니다 ${orderNumber}`,
    picked_up: `수령이 완료되었습니다 ${orderNumber}`,
    pickup_ready: `방문 수령 준비가 완료되었습니다 ${orderNumber}`,
    return_request_confirmation: `교환·반품 문의가 접수되었습니다 ${orderNumber}`,
    return_request_confirmation_kakao: `교환·반품 문의가 접수되었습니다 ${orderNumber}`,
  }[template];
}

function stringPayload(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberPayload(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatCurrency(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "확인 중";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
