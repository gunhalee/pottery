import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase/server";

import type { OrderDraftInput, OrderDraftResult } from "./order-model";

export type CheckoutAttemptStatus =
  | "started"
  | "order_created"
  | "payment_prepared"
  | "payment_pending"
  | "payment_paid"
  | "payment_failed"
  | "payment_canceled"
  | "payment_expired"
  | "manual_review";

export type CheckoutAttemptRecord = {
  attemptId: string;
  errorCode: string | null;
  errorMessage: string | null;
  orderId: string | null;
  orderNumber: string | null;
  payloadHash: string;
  paymentId: string | null;
  recoveryTokenExpiresAt: string | null;
  status: CheckoutAttemptStatus;
};

export type CheckoutAttemptClaim =
  | { kind: "claimed"; record: CheckoutAttemptRecord | null }
  | { kind: "conflict"; record: CheckoutAttemptRecord };

export type CheckoutRecoveryToken = {
  recoveryToken: string;
  recoveryTokenExpiresAt: string;
};

export const checkoutRecoveryTokenTtlMs = 1000 * 60 * 60 * 24;

type CheckoutAttemptRow = {
  attempt_id: string;
  error_code: string | null;
  error_message: string | null;
  order_id: string | null;
  order_number: string | null;
  payload_hash: string;
  payment_id: string | null;
  recovery_token_expires_at: string | null;
  status: CheckoutAttemptStatus;
};

export function createCheckoutPayloadHash(input: OrderDraftInput) {
  return sha256(
    stableStringify({
      cashReceiptIdentifier: Boolean(input.cashReceiptIdentifier),
      cashReceiptIdentifierType: input.cashReceiptIdentifierType ?? null,
      cashReceiptType: input.cashReceiptType ?? null,
      checkoutMode: input.checkoutMode,
      giftMessage: input.giftMessage?.trim() || null,
      lookupPassword: "redacted",
      madeToOrder: Boolean(input.madeToOrder),
      madeToOrderAcknowledged: Boolean(input.madeToOrderAcknowledged),
      notifyByEmail: Boolean(input.notifyByEmail),
      notifyByKakao: Boolean(input.notifyByKakao),
      ordererEmail: input.ordererEmail.trim().toLowerCase(),
      ordererName: input.ordererName.trim(),
      ordererPhone: input.ordererPhone.replace(/\D/g, ""),
      paymentMethod: input.paymentMethod ?? null,
      privacyAgreed: Boolean(input.privacyAgreed),
      productOption: input.productOption ?? null,
      productSlug: input.productSlug,
      quantity: input.quantity,
      recipientName: input.recipientName?.trim() || null,
      recipientPhone: input.recipientPhone?.replace(/\D/g, "") || null,
      shippingAddress1: input.shippingAddress1?.trim() || null,
      shippingAddress2: input.shippingAddress2?.trim() || null,
      shippingMemo: input.shippingMemo?.trim() || null,
      shippingMethod: input.shippingMethod,
      shippingPostcode: input.shippingPostcode?.trim() || null,
      termsAgreed: Boolean(input.termsAgreed),
    }),
  );
}

export async function claimCheckoutAttempt(input: {
  attemptId: string;
  payloadHash: string;
}): Promise<CheckoutAttemptClaim> {
  if (!isSupabaseConfigured()) {
    return { kind: "claimed", record: null };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_checkout_attempts")
    .insert({
      attempt_id: input.attemptId,
      payload_hash: input.payloadHash,
      status: "started",
    })
    .select(
      "attempt_id,error_code,error_message,order_id,order_number,payload_hash,payment_id,recovery_token_expires_at,status",
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      const existing = await readCheckoutAttemptByAttemptId(input.attemptId);
      if (existing) {
        return existing.payloadHash === input.payloadHash
          ? { kind: "claimed", record: existing }
          : { kind: "conflict", record: existing };
      }
    }

    throw error;
  }

  return { kind: "claimed", record: mapCheckoutAttemptRow(data) };
}

export async function attachOrderToCheckoutAttempt(input: {
  attemptId: string;
  order: Pick<OrderDraftResult, "orderId" | "orderNumber">;
  payloadHash: string;
}): Promise<CheckoutRecoveryToken | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const token = createCheckoutRecoveryToken();
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("shop_checkout_attempts")
    .update({
      order_id: input.order.orderId,
      order_number: input.order.orderNumber,
      payload_hash: input.payloadHash,
      recovery_token_expires_at: token.recoveryTokenExpiresAt,
      recovery_token_hash: hashRecoveryToken(token.recoveryToken),
      status: "order_created",
    })
    .eq("attempt_id", input.attemptId);

  if (error) {
    throw error;
  }

  return token;
}

export async function refreshCheckoutRecoveryToken(
  attemptId: string,
): Promise<CheckoutRecoveryToken | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const token = createCheckoutRecoveryToken();
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("shop_checkout_attempts")
    .update({
      recovery_token_expires_at: token.recoveryTokenExpiresAt,
      recovery_token_hash: hashRecoveryToken(token.recoveryToken),
    })
    .eq("attempt_id", attemptId);

  if (error) {
    throw error;
  }

  return token;
}

export async function readCheckoutAttemptByAttemptId(
  attemptId: string,
): Promise<CheckoutAttemptRecord | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_checkout_attempts")
    .select(
      "attempt_id,error_code,error_message,order_id,order_number,payload_hash,payment_id,recovery_token_expires_at,status",
    )
    .eq("attempt_id", attemptId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapCheckoutAttemptRow(data) : null;
}

export async function readCheckoutAttemptByRecovery(input: {
  attemptId: string;
  recoveryToken: string;
}): Promise<CheckoutAttemptRecord | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_checkout_attempts")
    .select(
      "attempt_id,error_code,error_message,order_id,order_number,payload_hash,payment_id,recovery_token_expires_at,recovery_token_hash,status",
    )
    .eq("attempt_id", input.attemptId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.recovery_token_hash || !data.recovery_token_expires_at) {
    return null;
  }

  if (new Date(data.recovery_token_expires_at).getTime() < Date.now()) {
    return null;
  }

  if (data.recovery_token_hash !== hashRecoveryToken(input.recoveryToken)) {
    return null;
  }

  return mapCheckoutAttemptRow(data);
}

export async function readCheckoutAttemptByOrderId(
  orderId: string,
): Promise<CheckoutAttemptRecord | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_checkout_attempts")
    .select(
      "attempt_id,error_code,error_message,order_id,order_number,payload_hash,payment_id,recovery_token_expires_at,status",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapCheckoutAttemptRow(data) : null;
}

export async function updateCheckoutAttemptPayment(input: {
  attemptId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  orderId?: string | null;
  paymentId?: string | null;
  status: CheckoutAttemptStatus;
}) {
  if (!isSupabaseConfigured()) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const patch: Record<string, unknown> = {
    error_code: input.errorCode ?? null,
    error_message: input.errorMessage ?? null,
    status: input.status,
  };

  if (input.paymentId !== undefined) {
    patch.payment_id = input.paymentId;
  }

  let query = supabase.from("shop_checkout_attempts").update(patch);
  if (input.attemptId) {
    query = query.eq("attempt_id", input.attemptId);
  } else if (input.orderId) {
    query = query.eq("order_id", input.orderId);
  } else {
    return;
  }

  const { error } = await query;
  if (error) {
    throw error;
  }
}

function createCheckoutRecoveryToken(): CheckoutRecoveryToken {
  return {
    recoveryToken: randomBytes(32).toString("base64url"),
    recoveryTokenExpiresAt: new Date(Date.now() + checkoutRecoveryTokenTtlMs).toISOString(),
  };
}

function hashRecoveryToken(token: string) {
  return sha256(token);
}

function mapCheckoutAttemptRow(row: CheckoutAttemptRow): CheckoutAttemptRecord {
  return {
    attemptId: row.attempt_id,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    orderId: row.order_id,
    orderNumber: row.order_number,
    payloadHash: row.payload_hash,
    paymentId: row.payment_id,
    recoveryTokenExpiresAt: row.recovery_token_expires_at,
    status: row.status,
  };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}
