import "server-only";

import { Cafe24ApiError, cafe24Fetch } from "./client";
import { getCafe24Config } from "./config";

export type Cafe24OrderLookupInput = {
  buyerName?: string;
  email?: string;
  orderId: string;
  phone?: string;
};

export type Cafe24OrderLookupResult = {
  buyerName: string | null;
  items: Array<{
    name: string;
    option: string | null;
    quantity: number | null;
    status: string | null;
  }>;
  orderDate: string | null;
  orderId: string;
  orderStatus: string | null;
  paymentStatus: string | null;
  receiverName: string | null;
  shipments: Array<{
    carrier: string | null;
    invoiceNo: string | null;
    shippedAt: string | null;
    status: string | null;
    trackingUrl: string | null;
  }>;
  shippingSummary: string;
};

export class Cafe24OrderLookupVerificationError extends Error {
  constructor() {
    super("주문 정보를 확인하지 못했습니다.");
    this.name = "Cafe24OrderLookupVerificationError";
  }
}

export async function lookupCafe24Order(
  input: Cafe24OrderLookupInput,
): Promise<Cafe24OrderLookupResult> {
  const orderId = input.orderId.trim();
  const email = input.email?.trim().toLowerCase() || "";
  const phone = normalizeDigits(input.phone);
  const buyerName = normalizeName(input.buyerName);

  if (!orderId || (!email && phone.length < 4)) {
    throw new Cafe24OrderLookupVerificationError();
  }

  const config = await getCafe24Config();
  const orderPayload = await cafe24Fetch(
    config,
    `/orders/${encodeURIComponent(orderId)}`,
    {
      searchParams: {
        embed: "buyer,receivers,items",
        shop_no: config.shopNo,
      },
    },
  );
  const order = extractRecord(orderPayload, "order");

  if (!order) {
    throw new Cafe24OrderLookupVerificationError();
  }

  if (!isOrderOwner({ buyerName, email, order, phone })) {
    throw new Cafe24OrderLookupVerificationError();
  }

  const shipments = await retrieveShipments(orderId).catch((error) => {
    if (error instanceof Cafe24ApiError && [404, 422].includes(error.status)) {
      return [];
    }

    throw error;
  });

  return {
    buyerName: firstString([
      order.buyer_name,
      nestedString(order.buyer, "name"),
      nestedString(order.buyer, "buyer_name"),
    ]),
    items: extractOrderItems(order).map((item) => ({
      name:
        firstString([item.product_name, item.item_name, item.productName]) ??
        "주문 상품",
      option: firstString([item.option_value, item.variant_name, item.options]),
      quantity: numberOrNull(item.quantity),
      status: firstString([item.order_status, item.status, item.shipping_status]),
    })),
    orderDate: firstString([order.order_date, order.created_date, order.created_at]),
    orderId,
    orderStatus: firstString([order.order_status, order.status]),
    paymentStatus: firstString([order.payment_status, order.paid, order.pay_status]),
    receiverName: firstString([
      nestedString(order.receiver, "name"),
      firstRecordString(order.receivers, "name"),
      firstRecordString(order.receivers, "receiver_name"),
    ]),
    shipments,
    shippingSummary: summarizeShipping(order, shipments),
  };
}

async function retrieveShipments(orderId: string) {
  const config = await getCafe24Config();
  const payload = await cafe24Fetch(
    config,
    `/orders/${encodeURIComponent(orderId)}/shipments`,
    {
      searchParams: {
        shop_no: config.shopNo,
      },
    },
  );

  return extractArray(payload, "shipments").map((shipment) => ({
    carrier: firstString([
      shipment.carrier_name,
      shipment.shipping_company_name,
      shipment.shipping_company,
      shipment.carrier_id,
    ]),
    invoiceNo: firstString([
      shipment.invoice_no,
      shipment.tracking_no,
      shipment.tracking_number,
    ]),
    shippedAt: firstString([
      shipment.shipping_date,
      shipment.shipped_date,
      shipment.created_date,
    ]),
    status: firstString([
      shipment.shipping_status,
      shipment.status,
      shipment.status_additional_info,
    ]),
    trackingUrl: firstString([
      shipment.tracking_url,
      shipment.invoice_url,
      shipment.shipping_trace_url,
    ]),
  }));
}

function isOrderOwner({
  buyerName,
  email,
  order,
  phone,
}: {
  buyerName: string;
  email: string;
  order: Record<string, unknown>;
  phone: string;
}) {
  const emailCandidates = collectStrings(order, [
    "buyer_email",
    "email",
    "member_email",
  ]).map((value) => value.toLowerCase());
  const phoneCandidates = collectStrings(order, [
    "buyer_phone",
    "buyer_cellphone",
    "cellphone",
    "phone",
    "receiver_phone",
    "receiver_cellphone",
  ]).map(normalizeDigits);
  const nameCandidates = collectStrings(order, [
    "buyer_name",
    "name",
    "receiver_name",
  ]).map(normalizeName);
  const emailMatched = Boolean(email && emailCandidates.includes(email));
  const phoneMatched = Boolean(
    phone.length >= 4 &&
      phoneCandidates.some(
        (candidate) => candidate && candidate.endsWith(phone),
      ),
  );
  const nameMatched = !buyerName || nameCandidates.includes(buyerName);

  return (emailMatched || phoneMatched) && nameMatched;
}

function summarizeShipping(
  order: Record<string, unknown>,
  shipments: Cafe24OrderLookupResult["shipments"],
) {
  if (shipments.some((shipment) => shipment.invoiceNo)) {
    return "송장 등록";
  }

  const orderStatus = firstString([
    order.order_status,
    order.shipping_status,
    order.status,
  ]);

  if (!orderStatus) {
    return "주문 확인";
  }

  if (/배송|ship|transit|delivery/i.test(orderStatus)) {
    return orderStatus;
  }

  if (/취소|cancel/i.test(orderStatus)) {
    return "주문 취소";
  }

  return "배송 준비";
}

function extractOrderItems(order: Record<string, unknown>) {
  const candidates = [
    extractArray(order, "items"),
    extractArray(order, "order_items"),
    extractArray(order, "products"),
  ].find((items) => items.length > 0);

  return candidates ?? [];
}

function collectStrings(record: Record<string, unknown>, keys: string[]) {
  const values: string[] = [];

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      values.push(value.trim());
    }
  }

  for (const value of Object.values(record)) {
    if (isRecord(value)) {
      values.push(...collectStrings(value, keys));
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (isRecord(item)) {
          values.push(...collectStrings(item, keys));
        }
      }
    }
  }

  return [...new Set(values)];
}

function extractRecord(payload: unknown, key: string) {
  if (!isRecord(payload)) {
    return null;
  }

  if (isRecord(payload[key])) {
    return payload[key] as Record<string, unknown>;
  }

  return payload;
}

function extractArray(payload: unknown, key: string) {
  if (!isRecord(payload)) {
    return [];
  }

  const value = payload[key];

  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }

  return [];
}

function firstString(values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return null;
}

function nestedString(value: unknown, key: string) {
  return isRecord(value) ? firstString([value[key]]) : null;
}

function firstRecordString(value: unknown, key: string) {
  if (!Array.isArray(value)) {
    return null;
  }

  const first = value.find(isRecord);
  return first ? firstString([first[key]]) : null;
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeDigits(value: string | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function normalizeName(value: string | undefined) {
  return (value ?? "").replace(/\s/g, "").toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
