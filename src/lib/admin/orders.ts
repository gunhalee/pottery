import "server-only";

import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import {
  enqueueAdminNotificationJob,
  enqueueOrderNotificationJobs,
  templateForFulfillmentStatus,
} from "@/lib/notifications/order-notifications";
import type {
  CashReceiptIdentifierType,
  CashReceiptStatus,
  CashReceiptType,
  FulfillmentStatus,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  ProductOption,
  RefundAccountStatus,
  ShippingMethod,
} from "@/lib/orders/order-model";
import {
  assertFulfillmentTransitionAllowed,
  deriveOrderStatusFromPaymentAndFulfillment,
} from "@/lib/orders/order-state";
import { syncPortOnePayment } from "@/lib/payments";

export type AdminOrderView =
  | "all"
  | "needs_action"
  | "payment"
  | "pickup"
  | "shipped"
  | "done"
  | "issues";

export type AdminOrderTone = "danger" | "done" | "neutral" | "priority" | "warning";

export type AdminOrderListItem = {
  actionLabel: string;
  ageLabel: string;
  createdAt: string;
  depositDueAt: string | null;
  depositReviewStatus: string;
  fulfillmentStatus: FulfillmentStatus;
  id: string;
  isGift: boolean;
  itemCount: number;
  itemSummary: string;
  latestShipment: AdminOrderShipment | null;
  orderNumber: string;
  orderStatus: OrderStatus;
  ordererEmail: string;
  ordererName: string;
  ordererPhoneLast4: string;
  paidAt: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  quantityTotal: number;
  recipientName: string | null;
  shippingMethod: ShippingMethod;
  tone: AdminOrderTone;
  totalKrw: number;
};

export type AdminOrderDashboard = {
  activeView: AdminOrderView;
  orders: AdminOrderListItem[];
  query: string;
  stats: AdminOrderStats;
  storageReady: boolean;
};

export type AdminOrderStats = {
  all: number;
  done: number;
  issues: number;
  needsAction: number;
  payment: number;
  pickup: number;
  shipped: number;
};

export type AdminOrderDetail = {
  canceledAt: string | null;
  cashReceiptIdentifierMasked: string | null;
  cashReceiptIdentifierType: CashReceiptIdentifierType | null;
  cashReceipts: AdminCashReceipt[];
  cashReceiptStatus: CashReceiptStatus;
  cashReceiptType: Exclude<CashReceiptType, "none"> | null;
  containsLivePlant: boolean;
  createdAt: string;
  currency: string;
  depositConfirmedAt: string | null;
  depositDueAt: string | null;
  depositReceivedAmountKrw: number | null;
  depositReviewNote: string | null;
  depositReviewStatus: string;
  events: AdminOrderEvent[];
  fulfillmentStatus: FulfillmentStatus;
  giftMessage: string | null;
  id: string;
  isGift: boolean;
  isMadeToOrder: boolean;
  items: AdminOrderItem[];
  latestShipment: AdminOrderShipment | null;
  madeToOrderDueMaxDays: number | null;
  madeToOrderDueMinDays: number | null;
  notifications: AdminOrderNotification[];
  orderNumber: string;
  orderStatus: OrderStatus;
  ordererEmail: string;
  ordererName: string;
  ordererPhone: string;
  ordererPhoneLast4: string;
  paidAt: string | null;
  paymentMethod: PaymentMethod;
  payments: AdminOrderPayment[];
  paymentStatus: PaymentStatus;
  portonePaymentId: string | null;
  portoneTransactionId: string | null;
  productOption: ProductOption;
  recipientName: string | null;
  recipientPhone: string | null;
  refundAccounts: AdminRefundAccount[];
  shipments: AdminOrderShipment[];
  shippingAddress1: string | null;
  shippingAddress2: string | null;
  shippingFeeKrw: number;
  shippingMemo: string | null;
  shippingMethod: ShippingMethod;
  shippingPostcode: string | null;
  subtotalKrw: number;
  totalKrw: number;
  updatedAt: string;
  virtualAccountAccountHolder: string | null;
  virtualAccountAccountNumber: string | null;
  virtualAccountBankName: string | null;
  virtualAccountIssuedAt: string | null;
};

export type AdminOrderEvent = {
  actor: string;
  createdAt: string;
  eventType: string;
  id: string;
  note: string | null;
};

export type AdminOrderItem = {
  lineTotalKrw: number;
  productSlug: string;
  productTitle: string;
  quantity: number;
  unitPriceKrw: number;
};

export type AdminCashReceipt = {
  amountKrw: number;
  approvalNumber: string | null;
  createdAt: string;
  errorMessage: string | null;
  id: string;
  identifierMasked: string;
  identifierType: CashReceiptIdentifierType;
  receiptType: Exclude<CashReceiptType, "none">;
  status: "pending" | "issued" | "failed" | "canceled";
};

export type AdminRefundAccount = {
  accountHolder: string;
  accountNumberMasked: string;
  adminNote: string | null;
  bankName: string;
  confirmedAt: string | null;
  createdAt: string;
  depositorName: string | null;
  id: string;
  refundAmountKrw: number | null;
  refundedAt: string | null;
  refundReason: string | null;
  status: Exclude<RefundAccountStatus, "none">;
  submittedAt: string;
};

export type AdminOrderPayment = {
  amountKrw: number;
  createdAt: string;
  id: string;
  paymentMethod: string | null;
  provider: string;
  providerPaymentId: string;
  providerTransactionId: string | null;
  status: PaymentStatus;
  updatedAt: string;
};

export type AdminOrderNotification = {
  channel: "email" | "kakao";
  createdAt: string;
  errorMessage: string | null;
  id: string;
  recipient: string | null;
  sentAt: string | null;
  status: "failed" | "pending" | "sent" | "skipped";
  template: string;
};

export type AdminOrderShipment = {
  carrier: string | null;
  createdAt: string;
  deliveredAt: string | null;
  id: string;
  shippedAt: string | null;
  status: "canceled" | "delivered" | "preparing" | "returned" | "shipped";
  trackingNumber: string | null;
  trackingUrl: string | null;
  updatedAt: string;
};

export type UpdateAdminOrderFulfillmentInput = {
  allowBackwardFulfillment: boolean;
  carrier: string | null;
  fulfillmentStatus: FulfillmentStatus;
  note: string | null;
  orderId: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
};

export type UpdateAdminRefundAccountInput = {
  adminNote: string | null;
  orderId: string;
  refundAccountId: string;
  status: Exclude<RefundAccountStatus, "none" | "needs_review"> | "needs_review";
};

type OrderRow = {
  canceled_at: string | null;
  cash_receipt_identifier_masked: string | null;
  cash_receipt_identifier_type: CashReceiptIdentifierType | null;
  cash_receipt_status: CashReceiptStatus;
  cash_receipt_type: Exclude<CashReceiptType, "none"> | null;
  contains_live_plant: boolean;
  created_at: string;
  currency: string;
  deposit_confirmed_at: string | null;
  deposit_due_at: string | null;
  deposit_received_amount_krw: number | null;
  deposit_review_note: string | null;
  deposit_review_status: string;
  fulfillment_status: FulfillmentStatus;
  gift_message: string | null;
  id: string;
  is_gift: boolean;
  is_made_to_order: boolean;
  made_to_order_due_max_days: number | null;
  made_to_order_due_min_days: number | null;
  order_number: string;
  order_status: OrderStatus;
  orderer_email: string;
  orderer_name: string;
  orderer_phone: string;
  orderer_phone_last4: string;
  paid_at: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  portone_payment_id: string | null;
  portone_transaction_id: string | null;
  product_option: ProductOption;
  recipient_name: string | null;
  recipient_phone: string | null;
  shipping_address1: string | null;
  shipping_address2: string | null;
  shipping_fee_krw: number;
  shipping_memo: string | null;
  shipping_method: ShippingMethod;
  shipping_postcode: string | null;
  subtotal_krw: number;
  total_krw: number;
  updated_at: string;
  virtual_account_account_holder: string | null;
  virtual_account_account_number: string | null;
  virtual_account_bank_name: string | null;
  virtual_account_issued_at: string | null;
};

type OrderItemRow = {
  line_total_krw: number;
  order_id: string;
  product_slug: string;
  product_title: string;
  quantity: number;
  unit_price_krw: number;
};

type PaymentRow = {
  amount_krw: number;
  created_at: string;
  id: string;
  payment_method: string | null;
  provider: string;
  provider_payment_id: string;
  provider_transaction_id: string | null;
  status: PaymentStatus;
  updated_at: string;
};

type CashReceiptRow = {
  amount_krw: number;
  approval_number: string | null;
  created_at: string;
  error_message: string | null;
  id: string;
  identifier_masked: string;
  identifier_type: CashReceiptIdentifierType;
  receipt_type: Exclude<CashReceiptType, "none">;
  status: AdminCashReceipt["status"];
};

type RefundAccountRow = {
  account_holder: string;
  account_number_masked: string;
  admin_note: string | null;
  bank_name: string;
  confirmed_at: string | null;
  created_at: string;
  depositor_name: string | null;
  id: string;
  refund_amount_krw: number | null;
  refunded_at: string | null;
  refund_reason: string | null;
  status: Exclude<RefundAccountStatus, "none">;
  submitted_at: string;
};

type NotificationRow = {
  channel: AdminOrderNotification["channel"];
  created_at: string;
  error_message: string | null;
  id: string;
  recipient: string | null;
  sent_at: string | null;
  status: AdminOrderNotification["status"];
  template: string;
};

type ShipmentRow = {
  carrier: string | null;
  created_at: string;
  delivered_at: string | null;
  id: string;
  order_id: string;
  shipped_at: string | null;
  status: AdminOrderShipment["status"];
  tracking_number: string | null;
  tracking_url: string | null;
  updated_at: string;
};

type EventRow = {
  actor: string;
  created_at: string;
  event_type: string;
  id: string;
  note: string | null;
};

const orderSelect =
  "id, order_number, order_status, payment_status, payment_method, fulfillment_status, orderer_name, orderer_phone, orderer_phone_last4, orderer_email, is_gift, gift_message, recipient_name, recipient_phone, shipping_postcode, shipping_address1, shipping_address2, shipping_memo, shipping_method, currency, subtotal_krw, shipping_fee_krw, total_krw, portone_payment_id, portone_transaction_id, paid_at, canceled_at, created_at, updated_at, product_option, contains_live_plant, is_made_to_order, made_to_order_due_min_days, made_to_order_due_max_days, deposit_due_at, deposit_confirmed_at, deposit_received_amount_krw, deposit_review_status, deposit_review_note, virtual_account_bank_name, virtual_account_account_number, virtual_account_account_holder, virtual_account_issued_at, cash_receipt_type, cash_receipt_identifier_type, cash_receipt_identifier_masked, cash_receipt_status";

const emptyStats: AdminOrderStats = {
  all: 0,
  done: 0,
  issues: 0,
  needsAction: 0,
  payment: 0,
  pickup: 0,
  shipped: 0,
};

export function normalizeAdminOrderView(value: string | undefined) {
  return isAdminOrderView(value) ? value : "all";
}

export async function getAdminOrderDashboard({
  query,
  view,
}: {
  query?: string;
  view?: string;
} = {}): Promise<AdminOrderDashboard> {
  const activeView = normalizeAdminOrderView(view);
  const normalizedQuery = normalizeSearchQuery(query);

  if (!isSupabaseConfigured()) {
    return {
      activeView,
      orders: [],
      query: normalizedQuery,
      stats: emptyStats,
      storageReady: false,
    };
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_orders")
    .select(orderSelect)
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) {
    if (isOrderStorageMissingError(error)) {
      return {
        activeView,
        orders: [],
        query: normalizedQuery,
        stats: emptyStats,
        storageReady: false,
      };
    }

    throw new Error(`주문 목록을 불러오지 못했습니다: ${error.message}`);
  }

  const rows = (data ?? []) as OrderRow[];
  const orderIds = rows.map((row) => row.id);
  const [itemsByOrderId, latestShipmentsByOrderId] = await Promise.all([
    readItemsByOrderId(orderIds),
    readLatestShipmentsByOrderId(orderIds),
  ]);
  const allOrders = rows.map((row) =>
    toAdminOrderListItem(
      row,
      itemsByOrderId.get(row.id) ?? [],
      latestShipmentsByOrderId.get(row.id) ?? null,
    ),
  );
  const stats = buildStats(allOrders);
  const filtered = allOrders
    .filter((order) => matchesOrderView(order, activeView))
    .filter((order) => matchesOrderSearch(order, normalizedQuery))
    .sort(compareAdminOrders);

  return {
    activeView,
    orders: filtered,
    query: normalizedQuery,
    stats,
    storageReady: true,
  };
}

export async function getAdminOrderDetail(
  orderId: string,
): Promise<AdminOrderDetail | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_orders")
    .select(orderSelect)
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    if (isOrderStorageMissingError(error)) {
      return null;
    }

    throw new Error(`주문을 불러오지 못했습니다: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const order = data as OrderRow;
  const [
    items,
    shipments,
    payments,
    notifications,
    events,
    cashReceipts,
    refundAccounts,
  ] = await Promise.all([
    readOrderItems(order.id),
    readOrderShipments(order.id),
    readOrderPayments(order.id),
    readOrderNotifications(order.id),
    readOrderEvents(order.id),
    readCashReceipts(order.id),
    readRefundAccounts(order.id),
  ]);

  return {
    canceledAt: order.canceled_at,
    cashReceiptIdentifierMasked: order.cash_receipt_identifier_masked,
    cashReceiptIdentifierType: order.cash_receipt_identifier_type,
    cashReceipts,
    cashReceiptStatus: order.cash_receipt_status,
    cashReceiptType: order.cash_receipt_type,
    containsLivePlant: order.contains_live_plant,
    createdAt: order.created_at,
    currency: order.currency,
    depositConfirmedAt: order.deposit_confirmed_at,
    depositDueAt: order.deposit_due_at,
    depositReceivedAmountKrw: order.deposit_received_amount_krw,
    depositReviewNote: order.deposit_review_note,
    depositReviewStatus: order.deposit_review_status,
    events,
    fulfillmentStatus: order.fulfillment_status,
    giftMessage: order.gift_message,
    id: order.id,
    isGift: order.is_gift,
    isMadeToOrder: order.is_made_to_order,
    items,
    latestShipment: shipments[0] ?? null,
    madeToOrderDueMaxDays: order.made_to_order_due_max_days,
    madeToOrderDueMinDays: order.made_to_order_due_min_days,
    notifications,
    orderNumber: order.order_number,
    orderStatus: order.order_status,
    ordererEmail: order.orderer_email,
    ordererName: order.orderer_name,
    ordererPhone: order.orderer_phone,
    ordererPhoneLast4: order.orderer_phone_last4,
    paidAt: order.paid_at,
    paymentMethod: order.payment_method,
    payments,
    paymentStatus: order.payment_status,
    portonePaymentId: order.portone_payment_id,
    portoneTransactionId: order.portone_transaction_id,
    productOption: order.product_option,
    recipientName: order.recipient_name,
    recipientPhone: order.recipient_phone,
    refundAccounts,
    shipments,
    shippingAddress1: order.shipping_address1,
    shippingAddress2: order.shipping_address2,
    shippingFeeKrw: order.shipping_fee_krw,
    shippingMemo: order.shipping_memo,
    shippingMethod: order.shipping_method,
    shippingPostcode: order.shipping_postcode,
    subtotalKrw: order.subtotal_krw,
    totalKrw: order.total_krw,
    updatedAt: order.updated_at,
    virtualAccountAccountHolder: order.virtual_account_account_holder,
    virtualAccountAccountNumber: order.virtual_account_account_number,
    virtualAccountBankName: order.virtual_account_bank_name,
    virtualAccountIssuedAt: order.virtual_account_issued_at,
  };
}

export async function updateAdminOrderFulfillment(
  input: UpdateAdminOrderFulfillmentInput,
) {
  if (!isSupabaseConfigured()) {
    throw new Error("주문 저장소가 아직 연결되지 않았습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_orders")
    .select(
      "id, order_number, order_status, payment_status, fulfillment_status, orderer_email, orderer_phone, shipping_method",
    )
    .eq("id", input.orderId)
    .maybeSingle();

  if (error) {
    throw new Error(`주문 상태 확인에 실패했습니다: ${error.message}`);
  }

  if (!data) {
    throw new Error("주문을 찾을 수 없습니다.");
  }

  const order = data as Pick<
    OrderRow,
    | "id"
    | "fulfillment_status"
    | "order_number"
    | "order_status"
    | "orderer_email"
    | "orderer_phone"
    | "payment_status"
    | "shipping_method"
  >;

  assertFulfillmentTransitionAllowed({
    allowBackwardFulfillment: input.allowBackwardFulfillment,
    currentFulfillmentStatus: order.fulfillment_status,
    nextFulfillmentStatus: input.fulfillmentStatus,
    orderStatus: order.order_status,
    paymentStatus: order.payment_status,
    shippingMethod: order.shipping_method,
  });

  const nextOrderStatus = deriveOrderStatusFromPaymentAndFulfillment({
    fulfillmentStatus: input.fulfillmentStatus,
    orderStatus: order.order_status,
    paymentStatus: order.payment_status,
  });
  const { error: updateError } = await supabase
    .from("shop_orders")
    .update({
      fulfillment_status: input.fulfillmentStatus,
      order_status: nextOrderStatus,
    })
    .eq("id", order.id);

  if (updateError) {
    throw new Error(`주문 상태 저장에 실패했습니다: ${updateError.message}`);
  }

  await upsertShipmentForFulfillment(input, order.shipping_method);

  const { error: eventError } = await supabase.from("shop_order_events").insert({
    actor: "admin",
    event_type: "fulfillment_status_updated",
    note: input.note,
    order_id: order.id,
    payload: {
      carrier: input.carrier,
      fulfillmentStatus: input.fulfillmentStatus,
      orderStatus: nextOrderStatus,
      previousFulfillmentStatus: order.fulfillment_status,
      trackingNumber: input.trackingNumber,
      trackingUrl: input.trackingUrl,
    },
  });

  if (eventError) {
    throw new Error(`처리 기록 저장에 실패했습니다: ${eventError.message}`);
  }

  const notificationTemplate =
    order.fulfillment_status !== input.fulfillmentStatus
      ? templateForFulfillmentStatus(input.fulfillmentStatus)
      : null;

  if (notificationTemplate) {
    await enqueueOrderNotificationJobs({
      orderId: order.id,
      orderNumber: order.order_number,
      payload: {
        carrier: input.carrier,
        fulfillmentStatus: input.fulfillmentStatus,
        trackingNumber: input.trackingNumber,
        trackingUrl: input.trackingUrl,
      },
      recipient: {
        email: order.orderer_email,
        phone: order.orderer_phone,
      },
      template: notificationTemplate,
    });

    if (input.fulfillmentStatus === "shipped") {
      await enqueueAdminNotificationJob({
        orderId: order.id,
        orderNumber: order.order_number,
        payload: {
          carrier: input.carrier,
          trackingNumber: input.trackingNumber,
          trackingUrl: input.trackingUrl,
        },
        template: "admin_fulfillment_shipped",
      });
    }
  }

  return {
    orderNumber: order.order_number,
  };
}

export async function syncAdminPortOnePayment(orderId: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("주문 저장소가 아직 연결되지 않았습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_orders")
    .select("id, order_number, portone_payment_id")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`주문 확인에 실패했습니다: ${error?.message ?? "주문 없음"}`);
  }

  const order = data as Pick<
    OrderRow,
    "id" | "order_number" | "portone_payment_id"
  >;

  if (!order.portone_payment_id) {
    throw new Error("PortOne 결제 ID가 아직 발급되지 않았습니다.");
  }

  await syncPortOnePayment({
    orderId: order.id,
    paymentId: order.portone_payment_id,
    source: "admin",
  });

  return {
    orderNumber: order.order_number,
  };
}

export async function updateAdminRefundAccount(
  input: UpdateAdminRefundAccountInput,
) {
  if (!isSupabaseConfigured()) {
    throw new Error("주문 저장소가 아직 연결되지 않았습니다.");
  }

  const now = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  const payload: Record<string, string | null> = {
    admin_note: input.adminNote,
    status: input.status,
  };

  if (input.status === "confirmed") {
    payload.confirmed_at = now;
  }

  if (input.status === "refunded") {
    payload.refunded_at = now;
  }

  const { error } = await supabase
    .from("shop_refund_accounts")
    .update(payload)
    .eq("id", input.refundAccountId)
    .eq("order_id", input.orderId);

  if (error) {
    throw new Error(`환불계좌 상태 저장에 실패했습니다: ${error.message}`);
  }

  await supabase.from("shop_order_events").insert({
    actor: "admin",
    event_type: "refund_account_status_updated",
    note: input.adminNote,
    order_id: input.orderId,
    payload: {
      refundAccountId: input.refundAccountId,
      status: input.status,
    },
  });
}

async function readItemsByOrderId(orderIds: string[]) {
  const itemsByOrderId = new Map<string, AdminOrderItem[]>();

  if (orderIds.length === 0) {
    return itemsByOrderId;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_order_items")
    .select(
      "order_id, product_slug, product_title, unit_price_krw, quantity, line_total_krw",
    )
    .in("order_id", orderIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`주문 상품을 불러오지 못했습니다: ${error.message}`);
  }

  for (const row of (data ?? []) as OrderItemRow[]) {
    const list = itemsByOrderId.get(row.order_id) ?? [];
    list.push(toAdminOrderItem(row));
    itemsByOrderId.set(row.order_id, list);
  }

  return itemsByOrderId;
}

async function readLatestShipmentsByOrderId(orderIds: string[]) {
  const shipmentsByOrderId = new Map<string, AdminOrderShipment>();

  if (orderIds.length === 0) {
    return shipmentsByOrderId;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_shipments")
    .select(
      "id, order_id, carrier, tracking_number, tracking_url, status, shipped_at, delivered_at, created_at, updated_at",
    )
    .in("order_id", orderIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`배송 정보를 불러오지 못했습니다: ${error.message}`);
  }

  for (const row of (data ?? []) as ShipmentRow[]) {
    if (!shipmentsByOrderId.has(row.order_id)) {
      shipmentsByOrderId.set(row.order_id, toAdminOrderShipment(row));
    }
  }

  return shipmentsByOrderId;
}

async function readOrderItems(orderId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_order_items")
    .select("product_slug, product_title, unit_price_krw, quantity, line_total_krw")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`주문 상품을 불러오지 못했습니다: ${error.message}`);
  }

  return ((data ?? []) as Omit<OrderItemRow, "order_id">[]).map((row) =>
    toAdminOrderItem({ ...row, order_id: orderId }),
  );
}

async function readOrderShipments(orderId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_shipments")
    .select(
      "id, order_id, carrier, tracking_number, tracking_url, status, shipped_at, delivered_at, created_at, updated_at",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`배송 정보를 불러오지 못했습니다: ${error.message}`);
  }

  return ((data ?? []) as ShipmentRow[]).map(toAdminOrderShipment);
}

async function readOrderPayments(orderId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_payments")
    .select(
      "id, provider, provider_payment_id, provider_transaction_id, payment_method, status, amount_krw, created_at, updated_at",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`결제 기록을 불러오지 못했습니다: ${error.message}`);
  }

  return ((data ?? []) as PaymentRow[]).map((row) => ({
    amountKrw: row.amount_krw,
    createdAt: row.created_at,
    id: row.id,
    paymentMethod: row.payment_method,
    provider: row.provider,
    providerPaymentId: row.provider_payment_id,
    providerTransactionId: row.provider_transaction_id,
    status: row.status,
    updatedAt: row.updated_at,
  }));
}

async function readCashReceipts(orderId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_cash_receipts")
    .select(
      "id, receipt_type, identifier_type, identifier_masked, amount_krw, status, approval_number, error_message, created_at",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isOptionalCommerceTableMissingError(error, "shop_cash_receipts")) {
      return [];
    }

    throw new Error(`현금영수증 기록을 불러오지 못했습니다: ${error.message}`);
  }

  return ((data ?? []) as CashReceiptRow[]).map((row) => ({
    amountKrw: row.amount_krw,
    approvalNumber: row.approval_number,
    createdAt: row.created_at,
    errorMessage: row.error_message,
    id: row.id,
    identifierMasked: row.identifier_masked,
    identifierType: row.identifier_type,
    receiptType: row.receipt_type,
    status: row.status,
  }));
}

async function readRefundAccounts(orderId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_refund_accounts")
    .select(
      "id, bank_name, account_number_masked, account_holder, depositor_name, refund_reason, refund_amount_krw, status, submitted_at, confirmed_at, refunded_at, admin_note, created_at",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isOptionalCommerceTableMissingError(error, "shop_refund_accounts")) {
      return [];
    }

    throw new Error(`환불계좌 기록을 불러오지 못했습니다: ${error.message}`);
  }

  return ((data ?? []) as RefundAccountRow[]).map((row) => ({
    accountHolder: row.account_holder,
    accountNumberMasked: row.account_number_masked,
    adminNote: row.admin_note,
    bankName: row.bank_name,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
    depositorName: row.depositor_name,
    id: row.id,
    refundAmountKrw: row.refund_amount_krw,
    refundedAt: row.refunded_at,
    refundReason: row.refund_reason,
    status: row.status,
    submittedAt: row.submitted_at,
  }));
}

async function readOrderNotifications(orderId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_notification_jobs")
    .select(
      "id, channel, template, recipient, status, error_message, sent_at, created_at",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isNotificationStorageMissingError(error)) {
      return [];
    }

    throw new Error(`알림 작업을 불러오지 못했습니다: ${error.message}`);
  }

  return ((data ?? []) as NotificationRow[]).map((row) => ({
    channel: row.channel,
    createdAt: row.created_at,
    errorMessage: row.error_message,
    id: row.id,
    recipient: row.recipient,
    sentAt: row.sent_at,
    status: row.status,
    template: row.template,
  }));
}

async function readOrderEvents(orderId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_order_events")
    .select("id, event_type, actor, note, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    throw new Error(`주문 처리 기록을 불러오지 못했습니다: ${error.message}`);
  }

  return ((data ?? []) as EventRow[]).map((row) => ({
    actor: row.actor,
    createdAt: row.created_at,
    eventType: row.event_type,
    id: row.id,
    note: row.note,
  }));
}

async function upsertShipmentForFulfillment(
  input: UpdateAdminOrderFulfillmentInput,
  shippingMethod: ShippingMethod,
) {
  const shipmentStatus = shipmentStatusFromFulfillment(input.fulfillmentStatus);
  const hasShipmentText =
    Boolean(input.carrier) ||
    Boolean(input.trackingNumber) ||
    Boolean(input.trackingUrl);

  if (shippingMethod !== "parcel" || !shipmentStatus) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_shipments")
    .select("id, shipped_at, delivered_at")
    .eq("order_id", input.orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`기존 배송 정보 확인에 실패했습니다: ${error.message}`);
  }

  const now = new Date().toISOString();
  const existing = data as
    | Pick<ShipmentRow, "delivered_at" | "id" | "shipped_at">
    | null;

  if (!existing && !hasShipmentText && shipmentStatus === "preparing") {
    return;
  }

  const payload = {
    carrier: input.carrier,
    delivered_at:
      shipmentStatus === "delivered" ? (existing?.delivered_at ?? now) : null,
    order_id: input.orderId,
    shipped_at:
      shipmentStatus === "shipped" || shipmentStatus === "delivered"
        ? (existing?.shipped_at ?? now)
        : null,
    status: shipmentStatus,
    tracking_number: input.trackingNumber,
    tracking_url: input.trackingUrl,
  };

  if (existing) {
    const { error: updateError } = await supabase
      .from("shop_shipments")
      .update(payload)
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(`배송 정보 저장에 실패했습니다: ${updateError.message}`);
    }

    return;
  }

  const { error: insertError } = await supabase
    .from("shop_shipments")
    .insert(payload);

  if (insertError) {
    throw new Error(`배송 정보 저장에 실패했습니다: ${insertError.message}`);
  }
}

function toAdminOrderListItem(
  row: OrderRow,
  items: AdminOrderItem[],
  latestShipment: AdminOrderShipment | null,
): AdminOrderListItem {
  const itemCount = items.length;
  const quantityTotal = items.reduce((total, item) => total + item.quantity, 0);
  const firstItem = items[0];

  return {
    actionLabel: nextActionLabel(row),
    ageLabel: formatAgeLabel(row.created_at),
    createdAt: row.created_at,
    depositDueAt: row.deposit_due_at,
    depositReviewStatus: row.deposit_review_status,
    fulfillmentStatus: row.fulfillment_status,
    id: row.id,
    isGift: row.is_gift,
    itemCount,
    itemSummary: firstItem
      ? `${firstItem.productTitle}${itemCount > 1 ? ` 외 ${itemCount - 1}건` : ""}`
      : "상품 정보 없음",
    latestShipment,
    orderNumber: row.order_number,
    orderStatus: row.order_status,
    ordererEmail: row.orderer_email,
    ordererName: row.orderer_name,
    ordererPhoneLast4: row.orderer_phone_last4,
    paidAt: row.paid_at,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    quantityTotal,
    recipientName: row.recipient_name,
    shippingMethod: row.shipping_method,
    tone: orderTone(row),
    totalKrw: row.total_krw,
  };
}

function toAdminOrderItem(row: OrderItemRow): AdminOrderItem {
  return {
    lineTotalKrw: row.line_total_krw,
    productSlug: row.product_slug,
    productTitle: row.product_title,
    quantity: row.quantity,
    unitPriceKrw: row.unit_price_krw,
  };
}

function toAdminOrderShipment(row: ShipmentRow): AdminOrderShipment {
  return {
    carrier: row.carrier,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at,
    id: row.id,
    shippedAt: row.shipped_at,
    status: row.status,
    trackingNumber: row.tracking_number,
    trackingUrl: row.tracking_url,
    updatedAt: row.updated_at,
  };
}

function buildStats(orders: AdminOrderListItem[]): AdminOrderStats {
  return {
    all: orders.length,
    done: orders.filter((order) => matchesOrderView(order, "done")).length,
    issues: orders.filter((order) => matchesOrderView(order, "issues")).length,
    needsAction: orders.filter((order) =>
      matchesOrderView(order, "needs_action"),
    ).length,
    payment: orders.filter((order) => matchesOrderView(order, "payment")).length,
    pickup: orders.filter((order) => matchesOrderView(order, "pickup")).length,
    shipped: orders.filter((order) => matchesOrderView(order, "shipped")).length,
  };
}

function matchesOrderView(order: AdminOrderListItem, view: AdminOrderView) {
  if (view === "all") {
    return true;
  }

  if (view === "payment") {
    return (
      order.paymentStatus === "pending" ||
      order.paymentStatus === "unpaid" ||
      order.paymentStatus === "expired"
    );
  }

  if (view === "pickup") {
    return (
      order.shippingMethod === "pickup" &&
      ["unfulfilled", "preparing", "pickup_ready"].includes(
        order.fulfillmentStatus,
      )
    );
  }

  if (view === "shipped") {
    return order.fulfillmentStatus === "shipped";
  }

  if (view === "done") {
    return ["delivered", "picked_up"].includes(order.fulfillmentStatus);
  }

  if (view === "issues") {
    return (
      ["failed", "canceled", "partial_refunded", "refunded"].includes(
        order.paymentStatus,
      ) ||
      order.paymentStatus === "expired" ||
      ["canceled", "returned"].includes(order.fulfillmentStatus) ||
      ["canceled", "deposit_expired", "refunded"].includes(order.orderStatus)
    );
  }

  return (
    order.paymentStatus === "paid" &&
    ((order.shippingMethod === "parcel" &&
      ["unfulfilled", "preparing"].includes(order.fulfillmentStatus)) ||
      (order.shippingMethod === "pickup" &&
        ["unfulfilled", "preparing", "pickup_ready"].includes(
          order.fulfillmentStatus,
        )))
  );
}

function matchesOrderSearch(order: AdminOrderListItem, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    order.orderNumber,
    order.ordererName,
    order.ordererEmail,
    order.ordererPhoneLast4,
    order.recipientName,
    order.itemSummary,
    order.latestShipment?.carrier,
    order.latestShipment?.trackingNumber,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function compareAdminOrders(a: AdminOrderListItem, b: AdminOrderListItem) {
  const priorityDiff = priorityWeight(b) - priorityWeight(a);

  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function priorityWeight(order: AdminOrderListItem) {
  if (order.tone === "danger") {
    return 4;
  }

  if (order.tone === "priority") {
    return 3;
  }

  if (order.tone === "warning") {
    return 2;
  }

  return order.tone === "neutral" ? 1 : 0;
}

function nextActionLabel(row: OrderRow) {
  if (row.payment_status === "failed") {
    return "결제 실패 확인";
  }

  if (row.payment_status === "expired") {
    return "입금기한 만료";
  }

  if (row.payment_status === "refund_pending") {
    return "환불 처리";
  }

  if (
    row.payment_method === "portone_virtual_account" &&
    row.payment_status === "pending"
  ) {
    return "가상계좌 입금 대기";
  }

  if (row.payment_status === "pending" || row.payment_status === "unpaid") {
    return "PG 결제 확인 대기";
  }

  if (row.shipping_method === "pickup") {
    return {
      canceled: "취소 처리됨",
      delivered: "완료",
      picked_up: "수령 완료",
      pickup_ready: "수령 가능 안내",
      preparing: "방문수령 준비",
      returned: "반품 처리",
      shipped: "처리 확인",
      unfulfilled: "방문수령 준비",
    }[row.fulfillment_status];
  }

  return {
    canceled: "취소 처리됨",
    delivered: "완료",
    picked_up: "완료",
    pickup_ready: "처리 확인",
    preparing: "포장/발송 준비",
    returned: "반품 처리",
    shipped: "배송 추적",
    unfulfilled: "포장/발송 준비",
  }[row.fulfillment_status];
}

function orderTone(row: OrderRow): AdminOrderTone {
  if (
    ["failed", "expired", "canceled", "partial_refunded", "refunded"].includes(
      row.payment_status,
    ) ||
    ["canceled", "returned"].includes(row.fulfillment_status) ||
    ["canceled", "deposit_expired", "refunded"].includes(row.order_status)
  ) {
    return "danger";
  }

  if (
    row.payment_status === "paid" &&
    ["unfulfilled", "preparing", "pickup_ready"].includes(row.fulfillment_status)
  ) {
    return "priority";
  }

  if (
    row.payment_method === "portone_virtual_account" &&
    row.payment_status === "pending"
  ) {
    return "priority";
  }

  if (row.payment_status === "pending" || row.payment_status === "unpaid") {
    return "warning";
  }

  if (["delivered", "picked_up"].includes(row.fulfillment_status)) {
    return "done";
  }

  return "neutral";
}

function shipmentStatusFromFulfillment(
  fulfillmentStatus: FulfillmentStatus,
): AdminOrderShipment["status"] | null {
  if (fulfillmentStatus === "shipped" || fulfillmentStatus === "delivered") {
    return fulfillmentStatus;
  }

  if (fulfillmentStatus === "returned" || fulfillmentStatus === "canceled") {
    return fulfillmentStatus;
  }

  if (fulfillmentStatus === "preparing" || fulfillmentStatus === "unfulfilled") {
    return "preparing";
  }

  return null;
}

function isAdminOrderView(value: string | undefined): value is AdminOrderView {
  return (
    value === "all" ||
    value === "needs_action" ||
    value === "payment" ||
    value === "pickup" ||
    value === "shipped" ||
    value === "done" ||
    value === "issues"
  );
}

function isOrderStorageMissingError(error: { code?: string; message?: string }) {
  const message = error.message ?? "";

  return (
    error.code === "42P01" ||
    message.includes("shop_orders") ||
    message.includes("shop_order_items") ||
    message.includes("shop_shipments") ||
    message.includes("schema cache")
  );
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

function isOptionalCommerceTableMissingError(
  error: { code?: string; message?: string },
  tableName: string,
) {
  const message = error.message ?? "";

  return (
    error.code === "42P01" ||
    (message.includes(tableName) &&
      (message.includes("schema cache") || message.includes("does not exist")))
  );
}

function normalizeSearchQuery(query: string | undefined) {
  return (query ?? "").trim().slice(0, 80);
}

function formatAgeLabel(value: string) {
  const elapsedMs = Date.now() - new Date(value).getTime();
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60_000));

  if (elapsedMinutes < 60) {
    return `${Math.max(1, elapsedMinutes)}분 전`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours}시간 전`;
  }

  return `${Math.floor(elapsedHours / 24)}일 전`;
}
