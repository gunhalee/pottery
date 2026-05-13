import "server-only";

import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import {
  enqueueAdminNotificationJob,
  enqueueOrderNotificationJobs,
} from "@/lib/notifications/order-notifications";
import {
  decryptSensitiveText,
  encryptSensitiveText,
} from "@/lib/security/sensitive-data";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import type { OrderLookupInput } from "./order-model";
import { OrderLookupVerificationError } from "./order-model";

const defaultGiftAddressHours = 7 * 24;
const livePlantGiftAddressHours = 24;
const passwordHashPrefix = "scrypt";
const passwordKeyLength = 32;

type GiftLinkOrder = {
  contains_live_plant: boolean;
  id: string;
  is_gift: boolean;
  order_number: string;
  orderer_email: string | null;
  orderer_phone: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
};

type GiftRecipientLinkRow = {
  action_url_encrypted: string | null;
  expires_at: string;
  id: string;
  sent_at: string | null;
  status: "pending" | "submitted" | "expired" | "canceled";
  token_hash: string;
};

export type GiftRecipientAddressInput = {
  recipientName: string;
  recipientPhone: string;
  shippingAddress1: string;
  shippingAddress2?: string;
  shippingMemo?: string;
  shippingPostcode: string;
  token: string;
};

export type GiftAddressResendInput = OrderLookupInput & {
  recipientPhoneLast4: string;
};

export type GiftRecipientAddressState =
  | {
      kind: "invalid";
      message: string;
    }
  | {
      expiresAt: string;
      kind: "pending";
      orderNumber: string;
      recipientName: string | null;
    }
  | {
      kind: "submitted";
      message: string;
      orderNumber: string;
    };

export async function ensureGiftRecipientAddressRequest({
  order,
  paidAt = new Date(),
}: {
  order: GiftLinkOrder;
  paidAt?: Date;
}) {
  if (!isSupabaseConfigured() || !order.is_gift || !order.recipient_phone) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const existing = await readExistingPendingLink(order.id);

  if (existing) {
    if (existing.sent_at || existing.status === "submitted") {
      return {
        actionUrl: null,
        expiresAt: existing.expires_at,
      };
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashGiftToken(token);
    const actionUrl = buildGiftAddressUrl(token);

    await supabase
      .from("shop_gift_recipient_links")
      .update({
        action_url_encrypted: encryptSensitiveText(actionUrl),
        token_hash: tokenHash,
      })
      .eq("id", existing.id);

    await notifyGiftRecipient({ actionUrl, linkId: existing.id, order });

    return {
      actionUrl,
      expiresAt: existing.expires_at,
    };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    paidAt.getTime() +
      (order.contains_live_plant
        ? livePlantGiftAddressHours
        : defaultGiftAddressHours) *
        60 *
        60_000,
  ).toISOString();

  const { data, error } = await supabase
    .from("shop_gift_recipient_links")
    .insert({
      action_url_encrypted: encryptSensitiveText(buildGiftAddressUrl(token)),
      expires_at: expiresAt,
      order_id: order.id,
      recipient_name: order.recipient_name,
      recipient_phone: order.recipient_phone,
      status: "pending",
      token_hash: hashGiftToken(token),
    })
    .select("id, expires_at")
    .single();

  if (error) {
    throw new Error(`선물 배송지 입력 링크 생성 실패: ${error.message}`);
  }

  const actionUrl = buildGiftAddressUrl(token);
  await notifyGiftRecipient({
    actionUrl,
    linkId: (data as { id: string }).id,
    order,
  });

  return {
    actionUrl,
    expiresAt,
  };
}

export async function readGiftRecipientAddressState(
  token: string,
): Promise<GiftRecipientAddressState> {
  const link = await readGiftLinkByToken(token);

  if (!link) {
    return {
      kind: "invalid",
      message: "유효하지 않은 선물 배송 정보 입력 링크입니다.",
    };
  }

  if (link.status === "submitted") {
    return {
      kind: "submitted",
      message: "이미 배송 정보가 입력되었습니다.",
      orderNumber: link.shop_orders.order_number,
    };
  }

  if (link.status !== "pending" || new Date(link.expires_at) <= new Date()) {
    await markGiftLinkExpired(link.id);

    return {
      kind: "invalid",
      message: "배송 정보 입력 기한이 만료되었습니다. 주문자에게 문의해 주세요.",
    };
  }

  return {
    expiresAt: link.expires_at,
    kind: "pending",
    orderNumber: link.shop_orders.order_number,
    recipientName: link.recipient_name ?? link.shop_orders.recipient_name,
  };
}

export async function submitGiftRecipientAddress(
  input: GiftRecipientAddressInput,
) {
  const link = await readGiftLinkByToken(input.token);

  if (!link) {
    throw new Error("유효하지 않은 선물 배송 정보 입력 링크입니다.");
  }

  if (link.status !== "pending" || new Date(link.expires_at) <= new Date()) {
    await markGiftLinkExpired(link.id);
    throw new Error("배송 정보 입력 기한이 만료되었습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const recipientName = input.recipientName.trim();
  const recipientPhone = normalizePhone(input.recipientPhone);

  if (!recipientName || recipientPhone.length < 8) {
    throw new Error("수령인 정보를 확인해 주세요.");
  }

  if (!input.shippingPostcode.trim() || !input.shippingAddress1.trim()) {
    throw new Error("배송지 정보를 입력해 주세요.");
  }

  const now = new Date().toISOString();
  const { error: orderError } = await supabase
    .from("shop_orders")
    .update({
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      shipping_address1: input.shippingAddress1.trim(),
      shipping_address2: input.shippingAddress2?.trim() || null,
      shipping_memo: input.shippingMemo?.trim() || null,
      shipping_postcode: input.shippingPostcode.trim(),
    })
    .eq("id", link.order_id);

  if (orderError) {
    throw new Error(`배송 정보 저장 실패: ${orderError.message}`);
  }

  const { error: linkError } = await supabase
    .from("shop_gift_recipient_links")
    .update({
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      shipping_address1: input.shippingAddress1.trim(),
      shipping_address2: input.shippingAddress2?.trim() || null,
      shipping_memo: input.shippingMemo?.trim() || null,
      shipping_postcode: input.shippingPostcode.trim(),
      status: "submitted",
      submitted_at: now,
    })
    .eq("id", link.id);

  if (linkError) {
    throw new Error(`선물 배송 정보 상태 저장 실패: ${linkError.message}`);
  }

  await supabase.from("shop_order_events").insert({
    actor: "recipient",
    event_type: "gift_address_submitted",
    order_id: link.order_id,
    payload: {
      recipientName,
      shippingPostcode: input.shippingPostcode.trim(),
    },
  });

  await enqueueOrderNotificationJobs({
    orderId: link.order_id,
    orderNumber: link.shop_orders.order_number,
    payload: {
      recipientName,
    },
    recipient: {
      email: link.shop_orders.orderer_email,
      phone: link.shop_orders.orderer_phone,
    },
    template: "gift_address_submitted",
  });
  await enqueueAdminNotificationJob({
    orderId: link.order_id,
    orderNumber: link.shop_orders.order_number,
    payload: {
      recipientName,
    },
    template: "admin_gift_address_submitted",
  });

  return {
    orderNumber: link.shop_orders.order_number,
  };
}

export async function readGiftAddressStatus(orderId: string) {
  if (!isSupabaseConfigured()) {
    return {
      expiresAt: null,
      status: "not_applicable" as const,
    };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_gift_recipient_links")
    .select("status, expires_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return {
      expiresAt: null,
      status: "pending" as const,
    };
  }

  const link = data as Pick<GiftRecipientLinkRow, "expires_at" | "status">;

  return {
    expiresAt: link.expires_at,
    status:
      link.status === "pending" && new Date(link.expires_at) <= new Date()
        ? ("expired" as const)
        : link.status,
  };
}

export async function resendGiftRecipientAddressRequest(
  input: GiftAddressResendInput,
) {
  if (!isSupabaseConfigured()) {
    throw new Error("선물 배송 정보 알림 저장소가 설정되지 않았습니다.");
  }

  const order = await readVerifiedGiftOrder(input);

  if (!order.is_gift) {
    throw new Error("선물하기 주문이 아닙니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_gift_recipient_links")
    .select("id, status, expires_at, action_url_encrypted, recipient_phone")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error("재발송할 선물 배송 정보 링크를 찾지 못했습니다.");
  }

  const link = data as GiftRecipientLinkRow & {
    recipient_phone: string | null;
  };

  if (
    normalizePhoneLast4(link.recipient_phone ?? "") !==
    normalizePhoneLast4(input.recipientPhoneLast4)
  ) {
    throw new Error("수령인 연락처 뒤 4자리를 확인해 주세요.");
  }

  if (link.status !== "pending" || new Date(link.expires_at) <= new Date()) {
    await markGiftLinkExpired(link.id);
    throw new Error("배송 정보 입력 기한이 만료되어 기존 링크를 재발송할 수 없습니다.");
  }

  const actionUrl = decryptSensitiveText(link.action_url_encrypted);

  if (!actionUrl) {
    throw new Error("기존 링크 정보가 없어 재발송할 수 없습니다.");
  }

  await enqueueOrderNotificationJobs({
    orderId: order.id,
    orderNumber: order.order_number,
    payload: {
      actionUrl,
      recipientName: order.recipient_name,
    },
    recipient: {
      phone: order.recipient_phone,
    },
    template: "gift_address_request",
  });

  await supabase
    .from("shop_gift_recipient_links")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", link.id);

  return {
    expiresAt: link.expires_at,
  };
}

async function notifyGiftRecipient({
  actionUrl,
  linkId,
  order,
}: {
  actionUrl: string;
  linkId: string;
  order: GiftLinkOrder;
}) {
  const supabase = getSupabaseAdminClient();

  await enqueueOrderNotificationJobs({
    orderId: order.id,
    orderNumber: order.order_number,
    payload: {
      actionUrl,
      recipientName: order.recipient_name,
    },
    recipient: {
      phone: order.recipient_phone,
    },
    template: "gift_address_request",
  });

  await supabase
    .from("shop_gift_recipient_links")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", linkId);
}

async function readExistingPendingLink(orderId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_gift_recipient_links")
    .select("id, action_url_encrypted, token_hash, status, expires_at, sent_at")
    .eq("order_id", orderId)
    .in("status", ["pending", "submitted"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as GiftRecipientLinkRow;
}

async function readVerifiedGiftOrder(input: OrderLookupInput) {
  const orderNumber = input.orderNumber.trim().toUpperCase();
  const phoneLast4 = normalizePhoneLast4(input.phoneLast4);

  if (!orderNumber || !/^[0-9]{4}$/.test(phoneLast4)) {
    throw new OrderLookupVerificationError();
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_orders")
    .select(
      [
        "id",
        "order_number",
        "lookup_password_hash",
        "is_gift",
        "recipient_name",
        "recipient_phone",
      ].join(", "),
    )
    .eq("order_number", orderNumber)
    .eq("orderer_phone_last4", phoneLast4)
    .maybeSingle();

  if (error || !data) {
    throw new OrderLookupVerificationError();
  }

  const order = data as unknown as {
    id: string;
    is_gift: boolean;
    lookup_password_hash: string;
    order_number: string;
    recipient_name: string | null;
    recipient_phone: string | null;
  };

  if (!verifyLookupPassword(input.password, order.lookup_password_hash)) {
    throw new OrderLookupVerificationError();
  }

  return order;
}

async function readGiftLinkByToken(token: string) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_gift_recipient_links")
    .select(
      `
        id,
        order_id,
        status,
        expires_at,
        recipient_name,
        shop_orders (
          order_number,
          orderer_email,
          orderer_phone,
          recipient_name
        )
      `,
    )
    .eq("token_hash", hashGiftToken(token))
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as unknown as {
    expires_at: string;
    id: string;
    order_id: string;
    recipient_name: string | null;
    shop_orders: {
      order_number: string;
      orderer_email: string | null;
      orderer_phone: string | null;
      recipient_name: string | null;
    };
    status: "pending" | "submitted" | "expired" | "canceled";
  };
}

async function markGiftLinkExpired(linkId: string) {
  const supabase = getSupabaseAdminClient();
  await supabase
    .from("shop_gift_recipient_links")
    .update({ status: "expired" })
    .eq("id", linkId)
    .eq("status", "pending");
}

function buildGiftAddressUrl(tokenOrHash: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const url = new URL(`/gift/${encodeURIComponent(tokenOrHash)}`, baseUrl);

  return url.toString();
}

function hashGiftToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function normalizePhoneLast4(phone: string) {
  return normalizePhone(phone).slice(-4);
}

function verifyLookupPassword(password: string, storedHash: string) {
  const normalized = password.trim();

  if (!/^[0-9]{4}$/.test(normalized)) {
    return false;
  }

  const [prefix, salt, expectedHash] = storedHash.split("$");

  if (prefix !== passwordHashPrefix || !salt || !expectedHash) {
    return false;
  }

  const actual = Buffer.from(
    scryptSync(normalized, salt, passwordKeyLength).toString("hex"),
    "hex",
  );
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function giftAddressDeadlineLabel(containsLivePlant: boolean) {
  return containsLivePlant
    ? "입금 또는 결제 확인 후 24시간"
    : "결제 완료일 다음 날부터 7일";
}

export function giftAddressNotice(containsLivePlant: boolean) {
  return containsLivePlant
    ? "생화·식물 포함 선물은 수령 지연 시 상태가 달라질 수 있어 배송 정보 입력 기한이 24시간으로 적용됩니다."
    : "수령인이 결제 완료일 다음 날부터 7일 이내 배송 정보를 입력하지 않으면 주문이 취소될 수 있습니다.";
}

export function getGiftSenderNotice() {
  return "선물하기 주문의 취소와 환불은 결제자인 주문자에게 진행됩니다.";
}
