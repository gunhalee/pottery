import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getProductBySlug } from "@/lib/shop";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { enqueueOrderNotificationJobs } from "@/lib/notifications/order-notifications";
import type {
  FulfillmentStatus,
  OrderDraftInput,
  OrderDraftResult,
  OrderLookupInput,
  OrderLookupItem,
  OrderLookupResult,
  OrderLookupShipment,
  OrderStatus,
  PaymentStatus,
  ShippingMethod,
} from "./order-model";
import { OrderLookupVerificationError } from "./order-model";
import { calculateOrderAmounts } from "./pricing";

const passwordHashPrefix = "scrypt";
const passwordKeyLength = 32;

type OrderRow = {
  created_at: string;
  fulfillment_status: FulfillmentStatus;
  id: string;
  lookup_password_hash: string;
  order_number: string;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  recipient_name: string | null;
  shipping_fee_krw: number;
  shipping_method: ShippingMethod;
  subtotal_krw: number;
  total_krw: number;
};

type OrderItemRow = {
  line_total_krw: number;
  product_title: string;
  quantity: number;
  unit_price_krw: number;
};

type ShipmentRow = {
  carrier: string | null;
  status: OrderLookupShipment["status"];
  tracking_number: string | null;
  tracking_url: string | null;
};

type CreatedOrderRow = {
  id: string;
  order_number: string;
  payment_status: PaymentStatus;
  total_krw: number;
};

export class OrderDraftError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "OrderDraftError";
  }
}

export function generateOrderNumber(date = new Date()) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const suffix = String(randomInt(0, 999999)).padStart(6, "0");

  return `CP-${yyyy}${mm}${dd}-${suffix}`;
}

export function hashOrderLookupPassword(password: string) {
  const normalized = normalizeLookupPassword(password);
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(normalized, salt, passwordKeyLength).toString("hex");

  return `${passwordHashPrefix}$${salt}$${hash}`;
}

export function verifyOrderLookupPassword(password: string, storedHash: string) {
  const normalized = normalizeLookupPassword(password);
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

export async function createOrderDraft(
  input: OrderDraftInput,
): Promise<OrderDraftResult> {
  if (!isSupabaseConfigured()) {
    throw new OrderDraftError(
      "주문 저장소가 아직 연결되지 않았습니다. Supabase 환경변수와 주문 테이블을 먼저 준비해 주세요.",
      503,
    );
  }

  const product = await getProductBySlug(input.productSlug);

  if (!product || !product.published || product.isArchived) {
    throw new OrderDraftError("주문 가능한 상품을 찾지 못했습니다.");
  }

  if (
    product.commerce.availabilityStatus !== "available" ||
    product.commerce.price === null
  ) {
    throw new OrderDraftError("현재 주문 가능한 상품이 아닙니다.");
  }

  const quantity = Math.max(1, Math.floor(input.quantity));
  const stockQuantity = product.commerce.stockQuantity;

  if (stockQuantity !== null && quantity > stockQuantity) {
    throw new OrderDraftError("주문 가능한 수량을 초과했습니다.");
  }

  const amounts = calculateOrderAmounts({
    quantity,
    shippingMethod: input.shippingMethod,
    unitPrice: product.commerce.price,
  });

  if (amounts.subtotalKrw === null || amounts.totalKrw === null) {
    throw new OrderDraftError("상품 금액이 아직 준비되지 않았습니다.");
  }

  const ordererPhone = normalizePhone(input.ordererPhone);
  const ordererPhoneLast4 = normalizePhoneLast4(ordererPhone);

  if (!/^[0-9]{4}$/.test(ordererPhoneLast4)) {
    throw new OrderDraftError("주문자 연락처를 확인해 주세요.");
  }

  const lookupPasswordHash = hashOrderLookupPassword(input.lookupPassword);
  const supabase = getSupabaseAdminClient();
  const order = await insertOrderWithRetry({
    currency: product.commerce.currency,
    fulfillment_status: "unfulfilled",
    gift_message: emptyToNull(input.giftMessage),
    is_gift: input.checkoutMode === "gift",
    lookup_password_hash: lookupPasswordHash,
    order_status: "pending_payment",
    orderer_email: input.ordererEmail.trim(),
    orderer_name: input.ordererName.trim(),
    orderer_phone: ordererPhone,
    orderer_phone_last4: ordererPhoneLast4,
    payment_status: "pending",
    recipient_name: emptyToNull(input.recipientName),
    recipient_phone: emptyToNull(normalizePhone(input.recipientPhone ?? "")),
    shipping_address1: emptyToNull(input.shippingAddress1),
    shipping_address2: emptyToNull(input.shippingAddress2),
    shipping_fee_krw: amounts.shippingFeeKrw,
    shipping_memo: emptyToNull(input.shippingMemo),
    shipping_method: input.shippingMethod,
    shipping_postcode: emptyToNull(input.shippingPostcode),
    subtotal_krw: amounts.subtotalKrw,
    total_krw: amounts.totalKrw,
  });

  const { error: itemError } = await supabase.from("shop_order_items").insert({
    line_total_krw: amounts.subtotalKrw,
    order_id: order.id,
    product_id: product.id,
    product_slug: product.slug,
    product_title: product.titleKo,
    quantity,
    snapshot: {
      checkoutMode: input.checkoutMode,
      product: {
        category: product.category,
        kind: product.kind,
        slug: product.slug,
        titleKo: product.titleKo,
      },
      shippingMethod: input.shippingMethod,
    },
    unit_price_krw: product.commerce.price,
  });

  if (itemError) {
    await supabase.from("shop_orders").delete().eq("id", order.id);
    throw new OrderDraftError(`주문 상품 저장 실패: ${itemError.message}`, 500);
  }

  await supabase.from("shop_order_events").insert({
    actor: "customer",
    event_type: "order_draft_created",
    order_id: order.id,
    payload: {
      checkoutMode: input.checkoutMode,
      quantity,
      shippingMethod: input.shippingMethod,
    },
  });
  await enqueueOrderNotificationJobs({
    orderId: order.id,
    orderNumber: order.order_number,
    payload: {
      checkoutMode: input.checkoutMode,
      total: amounts.totalKrw,
    },
    recipient: {
      email: input.ordererEmail.trim(),
      phone: ordererPhone,
    },
    template: "order_received",
  });

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    paymentStatus: order.payment_status,
    total: order.total_krw,
  };
}

export async function lookupOrder(
  input: OrderLookupInput,
): Promise<OrderLookupResult> {
  if (!isSupabaseConfigured()) {
    throw new OrderLookupVerificationError();
  }

  const orderNumber = input.orderNumber.trim().toUpperCase();
  const phoneLast4 = normalizePhoneLast4(input.phoneLast4);

  if (!orderNumber || !/^[0-9]{4}$/.test(phoneLast4)) {
    throw new OrderLookupVerificationError();
  }

  const supabase = getSupabaseAdminClient();
  const { data: order, error } = await supabase
    .from("shop_orders")
    .select(
      "id, order_number, order_status, payment_status, fulfillment_status, recipient_name, shipping_method, subtotal_krw, shipping_fee_krw, total_krw, lookup_password_hash, created_at",
    )
    .eq("order_number", orderNumber)
    .eq("orderer_phone_last4", phoneLast4)
    .maybeSingle();

  if (error || !order) {
    throw new OrderLookupVerificationError();
  }

  const orderRow = order as OrderRow;

  if (!verifyOrderLookupPassword(input.password, orderRow.lookup_password_hash)) {
    throw new OrderLookupVerificationError();
  }

  const [items, shipments] = await Promise.all([
    readOrderItems(orderRow.id),
    readOrderShipments(orderRow.id),
  ]);

  return {
    createdAt: orderRow.created_at,
    fulfillmentStatus: orderRow.fulfillment_status,
    items,
    orderNumber: orderRow.order_number,
    orderStatus: orderRow.order_status,
    paymentStatus: orderRow.payment_status,
    recipientName: orderRow.recipient_name,
    shipments,
    shippingFee: orderRow.shipping_fee_krw,
    shippingMethod: orderRow.shipping_method,
    shippingSummary: summarizeShipping(orderRow.fulfillment_status, shipments),
    subtotal: orderRow.subtotal_krw,
    total: orderRow.total_krw,
  };
}

async function insertOrderWithRetry(
  row: Record<string, unknown>,
): Promise<CreatedOrderRow> {
  const supabase = getSupabaseAdminClient();
  let lastErrorMessage = "주문 번호 생성에 실패했습니다.";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from("shop_orders")
      .insert({
        ...row,
        order_number: generateOrderNumber(),
      })
      .select("id, order_number, payment_status, total_krw")
      .single();

    if (!error && data) {
      return data as CreatedOrderRow;
    }

    lastErrorMessage = error?.message ?? lastErrorMessage;

    if (error?.code !== "23505") {
      break;
    }
  }

  throw new OrderDraftError(`주문 저장 실패: ${lastErrorMessage}`, 500);
}

async function readOrderItems(orderId: string): Promise<OrderLookupItem[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_order_items")
    .select("product_title, unit_price_krw, quantity, line_total_krw")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`주문 상품 조회 실패: ${error.message}`);
  }

  return ((data ?? []) as OrderItemRow[]).map((item) => ({
    lineTotal: item.line_total_krw,
    name: item.product_title,
    quantity: item.quantity,
    status: null,
    unitPrice: item.unit_price_krw,
  }));
}

async function readOrderShipments(orderId: string): Promise<OrderLookupShipment[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_shipments")
    .select("carrier, tracking_number, tracking_url, status")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`배송 정보 조회 실패: ${error.message}`);
  }

  return ((data ?? []) as ShipmentRow[]).map((shipment) => ({
    carrier: shipment.carrier,
    status: shipment.status,
    trackingNumber: shipment.tracking_number,
    trackingUrl: shipment.tracking_url,
  }));
}

function summarizeShipping(
  fulfillmentStatus: FulfillmentStatus,
  shipments: OrderLookupShipment[],
) {
  const latestShipment = shipments[0];

  if (latestShipment?.trackingNumber) {
    return latestShipment.carrier
      ? `${latestShipment.carrier} ${latestShipment.trackingNumber}`
      : latestShipment.trackingNumber;
  }

  return {
    canceled: "주문 취소",
    delivered: "배송 완료",
    picked_up: "방문수령 완료",
    pickup_ready: "방문수령 준비",
    preparing: "배송 준비",
    returned: "반품 처리",
    shipped: "배송 중",
    unfulfilled: "주문 확인",
  }[fulfillmentStatus];
}

function normalizeLookupPassword(password: string) {
  const normalized = password.trim();

  if (!/^[0-9]{4}$/.test(normalized)) {
    throw new OrderLookupVerificationError();
  }

  return normalized;
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function normalizePhoneLast4(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-4);
}

function emptyToNull(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function randomInt(min: number, max: number) {
  const range = max - min + 1;
  const random = randomBytes(4).readUInt32BE(0);
  return min + (random % range);
}
