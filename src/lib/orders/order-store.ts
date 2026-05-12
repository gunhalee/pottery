import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { commerceConfig } from "@/lib/config/commerce";
import { enqueueOrderNotificationJobs } from "@/lib/notifications/order-notifications";
import { requestCashReceiptIssueForOrder } from "@/lib/payments/cash-receipt";
import {
  getSupabaseAdminClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";
import { getProductBySlug } from "@/lib/shop";
import {
  encryptSensitiveText,
  maskAccountNumber,
  maskCashReceiptIdentifier,
} from "@/lib/security/sensitive-data";
import { getDepositDueAt } from "./bank-transfer";
import type {
  CashReceiptStatus,
  CashReceiptType,
  DepositAccount,
  FulfillmentStatus,
  OrderDraftInput,
  OrderDraftResult,
  OrderLookupInput,
  OrderLookupItem,
  OrderLookupResult,
  OrderLookupShipment,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductOption,
  RefundAccountStatus,
  ShippingMethod,
} from "./order-model";
import { OrderLookupVerificationError } from "./order-model";
import { calculateOrderAmounts } from "./pricing";
import { isRestrictedPlantShippingAddress } from "./shipping-restrictions";

const passwordHashPrefix = "scrypt";
const passwordKeyLength = 32;

type OrderRow = {
  cash_receipt_status: CashReceiptStatus;
  contains_live_plant: boolean;
  created_at: string;
  deposit_confirmed_at: string | null;
  deposit_due_at: string | null;
  fulfillment_status: FulfillmentStatus;
  id: string;
  is_made_to_order: boolean;
  lookup_password_hash: string;
  made_to_order_due_max_days: number | null;
  made_to_order_due_min_days: number | null;
  order_number: string;
  order_status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  recipient_name: string | null;
  shipping_fee_krw: number;
  shipping_method: ShippingMethod;
  subtotal_krw: number;
  total_krw: number;
  virtual_account_account_holder: string | null;
  virtual_account_account_number: string | null;
  virtual_account_bank_name: string | null;
  virtual_account_issued_at: string | null;
};

type OrderItemRow = {
  line_total_krw: number;
  product_title: string;
  quantity: number;
  snapshot: Record<string, unknown> | null;
  unit_price_krw: number;
};

type ShipmentRow = {
  carrier: string | null;
  status: OrderLookupShipment["status"];
  tracking_number: string | null;
  tracking_url: string | null;
};

type CreatedOrderRow = {
  deposit_due_at: string | null;
  id: string;
  order_number: string;
  payment_method: PaymentMethod;
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

export type RefundAccountInput = OrderLookupInput & {
  accountHolder: string;
  accountNumber: string;
  bankName: string;
  depositorName?: string;
  refundAmount?: number;
  refundReason?: string;
};

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

  if (product.commerce.price === null) {
    throw new OrderDraftError("상품 금액이 아직 준비되지 않았습니다.");
  }

  const paymentMethod = normalizePaymentMethod(
    input.checkoutMode,
    input.paymentMethod,
  );
  const productOption = normalizeProductOption(input.productOption);
  const containsLivePlant =
    productOption === "plant_included" && product.plantOption.enabled;
  const isMadeToOrder = Boolean(input.madeToOrder);
  const isAvailable = product.commerce.availabilityStatus === "available";
  const canMakeToOrder = Boolean(
    product.madeToOrder.available && product.commerce.price !== null,
  );

  if (productOption === "plant_included" && !product.plantOption.enabled) {
    throw new OrderDraftError("이 상품은 식물 포함 옵션을 선택할 수 없습니다.");
  }

  if (isMadeToOrder) {
    if (!canMakeToOrder) {
      throw new OrderDraftError("이 상품은 추가 제작 주문을 받을 수 없습니다.");
    }

    if (!input.madeToOrderAcknowledged) {
      throw new OrderDraftError("추가 제작 기간 안내에 동의해 주세요.");
    }
  } else if (!isAvailable) {
    throw new OrderDraftError("현재 주문 가능한 상품 상태가 아닙니다.");
  }

  const quantity = Math.max(1, Math.floor(input.quantity));
  const stockQuantity = product.commerce.stockQuantity;

  if (!isMadeToOrder && stockQuantity !== null && quantity > stockQuantity) {
    throw new OrderDraftError("주문 가능한 수량을 초과했습니다.");
  }

  const unitPrice =
    product.commerce.price +
    (containsLivePlant ? product.plantOption.priceDelta : 0);

  if (unitPrice < 0) {
    throw new OrderDraftError("상품 옵션 금액을 확인해 주세요.");
  }

  if (
    containsLivePlant &&
    input.shippingMethod === "parcel" &&
    input.checkoutMode !== "gift"
  ) {
    if (commerceConfig.plantShipping.seasonalRestrictionEnabled) {
      throw new OrderDraftError(
        "혹한기 또는 혹서기 운영 제한으로 식물 포함 상품의 택배 주문을 받을 수 없습니다.",
      );
    }

    if (
      isRestrictedPlantShippingAddress({
        address1: input.shippingAddress1,
        address2: input.shippingAddress2,
        postcode: input.shippingPostcode,
      })
    ) {
      throw new OrderDraftError(
        "식물 포함 상품은 제주 및 도서산간 주소로 택배 발송할 수 없습니다.",
      );
    }
  }

  const amounts = calculateOrderAmounts({
    quantity,
    shippingMethod: input.shippingMethod,
    unitPrice,
  });

  if (amounts.subtotalKrw === null || amounts.totalKrw === null) {
    throw new OrderDraftError("상품 금액이 아직 준비되지 않았습니다.");
  }

  const ordererPhone = normalizePhone(input.ordererPhone);
  const ordererPhoneLast4 = normalizePhoneLast4(ordererPhone);

  if (!/^[0-9]{4}$/.test(ordererPhoneLast4)) {
    throw new OrderDraftError("주문자 연락처를 확인해 주세요.");
  }

  const cashReceipt = prepareCashReceipt(input, paymentMethod);
  const lookupPasswordHash = hashOrderLookupPassword(input.lookupPassword);
  const depositDueAt = isVirtualAccountPaymentMethod(paymentMethod)
    ? getDepositDueAt().toISOString()
    : null;
  const supabase = getSupabaseAdminClient();
  const order = await insertOrderWithRetry({
    cash_receipt_identifier_encrypted: cashReceipt.identifierEncrypted,
    cash_receipt_identifier_masked: cashReceipt.identifierMasked,
    cash_receipt_identifier_type: cashReceipt.identifierType,
    cash_receipt_requested: cashReceipt.requested,
    cash_receipt_status: cashReceipt.requested ? "requested" : "not_requested",
    cash_receipt_type: cashReceipt.receiptType,
    contains_live_plant: containsLivePlant,
    currency: product.commerce.currency,
    deposit_due_at: depositDueAt,
    deposit_review_status: isVirtualAccountPaymentMethod(paymentMethod)
      ? "waiting"
      : "not_applicable",
    depositor_name: null,
    fulfillment_status: "unfulfilled",
    gift_message: emptyToNull(input.giftMessage),
    is_gift: input.checkoutMode === "gift",
    is_made_to_order: isMadeToOrder,
    lookup_password_hash: lookupPasswordHash,
    made_to_order_acknowledged_at: isMadeToOrder
      ? new Date().toISOString()
      : null,
    made_to_order_due_max_days: isMadeToOrder
      ? product.madeToOrder.daysMax
      : null,
    made_to_order_due_min_days: isMadeToOrder
      ? product.madeToOrder.daysMin
      : null,
    order_status: "pending_payment",
    orderer_email: input.ordererEmail.trim(),
    orderer_name: input.ordererName.trim(),
    orderer_phone: ordererPhone,
    orderer_phone_last4: ordererPhoneLast4,
    payment_method: paymentMethod,
    payment_status: "pending",
    product_option: productOption,
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
      containsLivePlant,
      madeToOrder: isMadeToOrder
        ? {
            daysMax: product.madeToOrder.daysMax,
            daysMin: product.madeToOrder.daysMin,
          }
        : null,
      plantOption: containsLivePlant
        ? {
            priceDelta: product.plantOption.priceDelta,
            species: product.plantOption.species ?? null,
          }
        : null,
      product: {
        category: product.category,
        kind: product.kind,
        slug: product.slug,
        titleKo: product.titleKo,
      },
      productOption,
      shippingMethod: input.shippingMethod,
    },
    unit_price_krw: unitPrice,
  });

  if (itemError) {
    await supabase.from("shop_orders").delete().eq("id", order.id);
    throw new OrderDraftError(`주문 상품 저장 실패: ${itemError.message}`, 500);
  }

  if (paymentMethod === "bank_transfer" && !isMadeToOrder) {
    const { error: reserveError } = await supabase.rpc(
      "reserve_stock_for_bank_transfer_order",
      {
        p_order_id: order.id,
      },
    );

    if (reserveError) {
      await supabase.from("shop_orders").delete().eq("id", order.id);
      throw new OrderDraftError(
        `입금대기 재고 확보 실패: ${reserveError.message}`,
        409,
      );
    }
  }

  await supabase.from("shop_order_events").insert({
    actor: "customer",
    event_type:
      paymentMethod === "bank_transfer"
        ? "bank_transfer_order_created"
        : "order_draft_created",
    order_id: order.id,
    payload: {
      checkoutMode: input.checkoutMode,
      containsLivePlant,
      depositDueAt,
      isMadeToOrder,
      paymentMethod,
      productOption,
      quantity,
      shippingMethod: input.shippingMethod,
    },
  });
  await enqueueOrderNotificationJobs({
    orderId: order.id,
    orderNumber: order.order_number,
    payload: {
      checkoutMode: input.checkoutMode,
      paymentMethod,
      total: amounts.totalKrw,
    },
    recipient: {
      email: input.ordererEmail.trim(),
      phone: ordererPhone,
    },
    template: "order_received",
  });

  if (paymentMethod === "bank_transfer") {
    await enqueueOrderNotificationJobs({
      orderId: order.id,
      orderNumber: order.order_number,
      payload: {
        depositDueAt,
        depositorName: input.ordererName.trim(),
        total: amounts.totalKrw,
      },
      recipient: {
        email: input.ordererEmail.trim(),
        phone: ordererPhone,
      },
      template: "deposit_guide",
    });
  }

  return {
    depositDueAt,
    orderId: order.id,
    orderNumber: order.order_number,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    total: order.total_krw,
  };
}

export async function lookupOrder(
  input: OrderLookupInput,
): Promise<OrderLookupResult> {
  const orderRow = await readVerifiedOrder(input);
  const [items, shipments, refundAccountStatus] = await Promise.all([
    readOrderItems(orderRow.id),
    readOrderShipments(orderRow.id),
    readRefundAccountStatus(orderRow.id),
  ]);

  return {
    cashReceiptStatus: orderRow.cash_receipt_status,
    containsLivePlant: orderRow.contains_live_plant,
    createdAt: orderRow.created_at,
    depositAccount: readDepositAccount(orderRow),
    depositConfirmedAt: orderRow.deposit_confirmed_at,
    depositDueAt: orderRow.deposit_due_at,
    fulfillmentStatus: orderRow.fulfillment_status,
    isMadeToOrder: orderRow.is_made_to_order,
    items,
    madeToOrderDueMaxDays: orderRow.made_to_order_due_max_days,
    madeToOrderDueMinDays: orderRow.made_to_order_due_min_days,
    orderNumber: orderRow.order_number,
    orderStatus: orderRow.order_status,
    paymentMethod: orderRow.payment_method,
    paymentStatus: orderRow.payment_status,
    recipientName: orderRow.recipient_name,
    refundAccountStatus,
    shipments,
    shippingFee: orderRow.shipping_fee_krw,
    shippingMethod: orderRow.shipping_method,
    shippingSummary: summarizeShipping(orderRow.fulfillment_status, shipments),
    subtotal: orderRow.subtotal_krw,
    total: orderRow.total_krw,
  };
}

export async function saveRefundAccountForOrder(input: RefundAccountInput) {
  const order = await readVerifiedOrder(input);

  if (!requiresRefundAccountFallback(order.payment_method)) {
    throw new OrderDraftError(
      "계좌 환불 확인이 필요한 주문만 환불계좌를 등록할 수 있습니다.",
      400,
    );
  }

  const accountNumber = input.accountNumber.trim();

  if (!accountNumber || !input.bankName.trim() || !input.accountHolder.trim()) {
    throw new OrderDraftError("환불계좌 정보를 확인해 주세요.", 400);
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("shop_refund_accounts").insert({
    account_holder: input.accountHolder.trim(),
    account_number_encrypted: encryptSensitiveText(accountNumber),
    account_number_masked: maskAccountNumber(accountNumber),
    bank_name: input.bankName.trim(),
    depositor_name: emptyToNull(input.depositorName),
    order_id: order.id,
    refund_amount_krw:
      input.refundAmount !== undefined && Number.isFinite(input.refundAmount)
        ? Math.max(0, Math.floor(input.refundAmount))
        : null,
    refund_reason: emptyToNull(input.refundReason),
    status: "needs_review",
  });

  if (error) {
    throw new OrderDraftError(`환불계좌 저장 실패: ${error.message}`, 500);
  }

  await supabase.from("shop_order_events").insert({
    actor: "customer",
    event_type: "refund_account_submitted",
    order_id: order.id,
    payload: {
      accountHolder: input.accountHolder.trim(),
      bankName: input.bankName.trim(),
    },
  });

  return { status: "needs_review" as RefundAccountStatus };
}

async function readVerifiedOrder(input: OrderLookupInput): Promise<OrderRow> {
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
      [
        "id",
        "order_number",
        "order_status",
        "payment_status",
        "payment_method",
        "fulfillment_status",
        "recipient_name",
        "shipping_method",
        "subtotal_krw",
        "shipping_fee_krw",
        "total_krw",
        "lookup_password_hash",
        "created_at",
        "deposit_due_at",
        "deposit_confirmed_at",
        "virtual_account_bank_name",
        "virtual_account_account_number",
        "virtual_account_account_holder",
        "virtual_account_issued_at",
        "cash_receipt_status",
        "contains_live_plant",
        "is_made_to_order",
        "made_to_order_due_min_days",
        "made_to_order_due_max_days",
      ].join(", "),
    )
    .eq("order_number", orderNumber)
    .eq("orderer_phone_last4", phoneLast4)
    .maybeSingle();

  if (error || !order) {
    throw new OrderLookupVerificationError();
  }

  const orderRow = order as unknown as OrderRow;

  if (!verifyOrderLookupPassword(input.password, orderRow.lookup_password_hash)) {
    throw new OrderLookupVerificationError();
  }

  return orderRow;
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
      .select("id, order_number, payment_method, payment_status, deposit_due_at, total_krw")
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
    .select("product_title, unit_price_krw, quantity, line_total_krw, snapshot")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`주문 상품 조회 실패: ${error.message}`);
  }

  return ((data ?? []) as OrderItemRow[]).map((item) => ({
    lineTotal: item.line_total_krw,
    name: item.product_title,
    productOption: readProductOptionFromSnapshot(item.snapshot),
    quantity: item.quantity,
    status: null,
    unitPrice: item.unit_price_krw,
  }));
}

async function readOrderShipments(
  orderId: string,
): Promise<OrderLookupShipment[]> {
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

async function readRefundAccountStatus(
  orderId: string,
): Promise<RefundAccountStatus> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("shop_refund_accounts")
    .select("status")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.status) {
    return "none";
  }

  return data.status as RefundAccountStatus;
}

function prepareCashReceipt(
  input: OrderDraftInput,
  paymentMethod: PaymentMethod,
) {
  const requested =
    isCashReceiptPaymentMethod(paymentMethod) &&
    input.cashReceiptType !== undefined &&
    input.cashReceiptType !== "none";

  if (!requested) {
    return {
      identifierEncrypted: null,
      identifierMasked: null,
      identifierType: null,
      receiptType: null,
      requested: false,
    };
  }

  if (!input.cashReceiptIdentifierType || !input.cashReceiptIdentifier) {
    throw new OrderDraftError("현금영수증 발급 정보를 확인해 주세요.");
  }

  return {
    identifierEncrypted: encryptSensitiveText(input.cashReceiptIdentifier),
    identifierMasked: maskCashReceiptIdentifier(input.cashReceiptIdentifier),
    identifierType: input.cashReceiptIdentifierType,
    receiptType: input.cashReceiptType as Exclude<CashReceiptType, "none">,
    requested: true,
  };
}

export async function issueCashReceiptAfterBankTransferConfirmation(
  orderId: string,
) {
  return requestCashReceiptIssueForOrder(orderId);
}

function normalizePaymentMethod(
  checkoutMode: OrderDraftInput["checkoutMode"],
  paymentMethod: PaymentMethod | undefined,
): PaymentMethod {
  if (checkoutMode === "naver_pay") {
    return "naver_pay";
  }

  if (paymentMethod === "portone_transfer") {
    return "portone_transfer";
  }

  if (paymentMethod === "portone_virtual_account" || paymentMethod === "bank_transfer") {
    return "portone_virtual_account";
  }

  return paymentMethod === "portone" ? "portone" : "portone_card";
}

function isVirtualAccountPaymentMethod(paymentMethod: PaymentMethod) {
  return (
    paymentMethod === "portone_virtual_account" ||
    paymentMethod === "bank_transfer"
  );
}

function isCashReceiptPaymentMethod(paymentMethod: PaymentMethod) {
  return (
    paymentMethod === "portone_transfer" ||
    paymentMethod === "portone_virtual_account" ||
    paymentMethod === "bank_transfer"
  );
}

function requiresRefundAccountFallback(paymentMethod: PaymentMethod) {
  return isCashReceiptPaymentMethod(paymentMethod);
}

function readDepositAccount(order: OrderRow): DepositAccount | undefined {
  if (
    !order.virtual_account_bank_name ||
    !order.virtual_account_account_number ||
    !order.virtual_account_account_holder
  ) {
    return undefined;
  }

  return {
    accountHolder: order.virtual_account_account_holder,
    accountNumber: order.virtual_account_account_number,
    bankName: order.virtual_account_bank_name,
  };
}

function normalizeProductOption(
  productOption: ProductOption | undefined,
): ProductOption {
  return productOption === "plant_included"
    ? "plant_included"
    : "plant_excluded";
}

function readProductOptionFromSnapshot(
  snapshot: Record<string, unknown> | null,
) {
  const value = snapshot?.productOption;

  if (value === "plant_excluded" || value === "plant_included") {
    return value;
  }

  return null;
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
