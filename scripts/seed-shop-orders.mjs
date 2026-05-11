import { existsSync, readFileSync } from "node:fs";
import { randomBytes, scryptSync } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

loadEnvFile(".env.local");
loadEnvFile(".env");

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_SECRET_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to seed orders.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const baseDate = new Date("2026-05-11T10:00:00+09:00");
const lookupPassword = "1234";

const product = await readSeedProduct();
const scenarios = [
  {
    fulfillmentStatus: "unfulfilled",
    label: "결제 대기",
    orderNumber: "CP-20260511-990001",
    orderStatus: "pending_payment",
    paidAt: null,
    paymentStatus: "pending",
    shippingMethod: "parcel",
  },
  {
    fulfillmentStatus: "preparing",
    label: "배송 준비",
    orderNumber: "CP-20260511-990002",
    orderStatus: "preparing",
    paidAt: minutesAfter(32),
    paymentStatus: "paid",
    shippingMethod: "parcel",
  },
  {
    fulfillmentStatus: "shipped",
    label: "배송중",
    orderNumber: "CP-20260511-990003",
    orderStatus: "shipped",
    paidAt: minutesAfter(58),
    paymentStatus: "paid",
    shipment: {
      carrier: "계약 택배사",
      status: "shipped",
      trackingNumber: "123456789012",
      trackingUrl: "https://example.com/tracking/123456789012",
    },
    shippingMethod: "parcel",
  },
  {
    fulfillmentStatus: "pickup_ready",
    label: "방문수령 준비",
    orderNumber: "CP-20260511-990004",
    orderStatus: "preparing",
    paidAt: minutesAfter(75),
    paymentStatus: "paid",
    shippingMethod: "pickup",
  },
  {
    fulfillmentStatus: "picked_up",
    label: "방문수령 완료",
    orderNumber: "CP-20260511-990005",
    orderStatus: "delivered",
    paidAt: minutesAfter(95),
    paymentStatus: "paid",
    shippingMethod: "pickup",
  },
  {
    fulfillmentStatus: "canceled",
    label: "결제 실패",
    orderNumber: "CP-20260511-990006",
    orderStatus: "canceled",
    paidAt: null,
    paymentStatus: "failed",
    shippingMethod: "parcel",
  },
];

for (const [index, scenario] of scenarios.entries()) {
  await seedOrder(scenario, index);
}

console.log(
  `Seeded ${scenarios.length} shop orders. Lookup password for every seed order: ${lookupPassword}`,
);

async function seedOrder(scenario, index) {
  const quantity = index === 1 ? 2 : 1;
  const unitPrice = product.priceKrw ?? 38000;
  const subtotal = unitPrice * quantity;
  const shippingFee = scenario.shippingMethod === "parcel" ? 4000 : 0;
  const total = subtotal + shippingFee;
  const createdAt = minutesAfter(index * 17);
  const ordererPhone = `0105555${String(9000 + index).slice(-4)}`;
  const row = {
    canceled_at: scenario.orderStatus === "canceled" ? minutesAfter(index * 17 + 8) : null,
    created_at: createdAt,
    currency: "KRW",
    fulfillment_status: scenario.fulfillmentStatus,
    gift_message: index === 2 ? "포장 전 작은 카드 동봉 부탁드립니다." : null,
    is_gift: index === 2,
    lookup_password_hash: hashLookupPassword(lookupPassword),
    order_number: scenario.orderNumber,
    order_status: scenario.orderStatus,
    orderer_email: `order${index + 1}@example.com`,
    orderer_name: `테스트 주문자 ${index + 1}`,
    orderer_phone: ordererPhone,
    orderer_phone_last4: ordererPhone.slice(-4),
    paid_at: scenario.paidAt,
    payment_status: scenario.paymentStatus,
    portone_payment_id:
      scenario.paymentStatus === "paid" ? `seed-payment-${index + 1}` : null,
    portone_transaction_id:
      scenario.paymentStatus === "paid" ? `seed-transaction-${index + 1}` : null,
    recipient_name: `테스트 수령자 ${index + 1}`,
    recipient_phone: ordererPhone,
    shipping_address1:
      scenario.shippingMethod === "parcel" ? "서울시 강남구 테스트로 12" : null,
    shipping_address2: scenario.shippingMethod === "parcel" ? "3층" : null,
    shipping_fee_krw: shippingFee,
    shipping_memo:
      scenario.shippingMethod === "parcel" ? "문 앞에 놓아주세요." : null,
    shipping_method: scenario.shippingMethod,
    shipping_postcode: scenario.shippingMethod === "parcel" ? "06000" : null,
    subtotal_krw: subtotal,
    total_krw: total,
    updated_at: minutesAfter(index * 17 + 10),
  };

  const { data: order, error } = await supabase
    .from("shop_orders")
    .upsert(row, { onConflict: "order_number" })
    .select("id, order_number")
    .single();

  if (error || !order) {
    throw new Error(
      `Failed to upsert ${scenario.orderNumber}: ${error?.message ?? "no row"}`,
    );
  }

  await resetOrderRelations(order.id);

  await insertOrderItems({
    orderId: order.id,
    product,
    quantity,
    subtotal,
    unitPrice,
  });

  if (scenario.paymentStatus === "paid") {
    await insertPayment({
      amount: total,
      orderId: order.id,
      paymentId: row.portone_payment_id,
      status: "paid",
      transactionId: row.portone_transaction_id,
    });
  }

  if (scenario.paymentStatus === "failed") {
    await insertPayment({
      amount: total,
      orderId: order.id,
      paymentId: `seed-failed-payment-${index + 1}`,
      status: "failed",
      transactionId: null,
    });
  }

  if (scenario.shipment) {
    await insertShipment({
      orderId: order.id,
      shipment: scenario.shipment,
    });
  }

  await insertEvents({
    orderId: order.id,
    scenario,
  });
  await insertNotificationJobs({
    email: row.orderer_email,
    orderId: order.id,
    orderNumber: order.order_number,
    phone: row.orderer_phone,
    scenario,
  });

  console.log(`${order.order_number} ${scenario.label}`);
}

async function readSeedProduct() {
  const { data, error } = await supabase
    .from("shop_products")
    .select("id, slug, title_ko, price_krw")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(`Could not read shop_products: ${error.message}`);
  }

  return {
    id: data?.id ?? null,
    priceKrw: data?.price_krw ?? 38000,
    slug: data?.slug ?? "seed-product",
    title: data?.title_ko ?? "테스트 도자 작업물",
  };
}

async function resetOrderRelations(orderId) {
  await supabase.from("shop_order_events").delete().eq("order_id", orderId);
  await supabase.from("shop_shipments").delete().eq("order_id", orderId);
  await supabase.from("shop_payments").delete().eq("order_id", orderId);
  await supabase.from("shop_order_items").delete().eq("order_id", orderId);
}

async function insertOrderItems({ orderId, product, quantity, subtotal, unitPrice }) {
  const { error } = await supabase.from("shop_order_items").insert({
    line_total_krw: subtotal,
    order_id: orderId,
    product_id: product.id,
    product_slug: product.slug,
    product_title: product.title,
    quantity,
    snapshot: {
      checkoutMode: "standard",
      seeded: true,
      shippingMethod: "seed",
    },
    unit_price_krw: unitPrice,
  });

  if (error) {
    throw new Error(`Failed to insert order item: ${error.message}`);
  }
}

async function insertPayment({
  amount,
  orderId,
  paymentId,
  status,
  transactionId,
}) {
  const { error } = await supabase.from("shop_payments").insert({
    amount_krw: amount,
    order_id: orderId,
    provider: "portone",
    provider_payment_id: paymentId,
    provider_transaction_id: transactionId,
    raw_payload: {
      seeded: true,
      status,
    },
    status,
  });

  if (error) {
    throw new Error(`Failed to insert payment: ${error.message}`);
  }
}

async function insertShipment({ orderId, shipment }) {
  const now = new Date().toISOString();
  const { error } = await supabase.from("shop_shipments").insert({
    carrier: shipment.carrier,
    order_id: orderId,
    shipped_at: now,
    status: shipment.status,
    tracking_number: shipment.trackingNumber,
    tracking_url: shipment.trackingUrl,
  });

  if (error) {
    throw new Error(`Failed to insert shipment: ${error.message}`);
  }
}

async function insertEvents({ orderId, scenario }) {
  const events = [
    {
      actor: "customer",
      event_type: "order_draft_created",
      note: "Seed order created for local flow checks.",
      order_id: orderId,
      payload: { seeded: true },
    },
  ];

  if (scenario.paymentStatus === "paid") {
    events.push({
      actor: "system",
      event_type: "portone_payment_paid",
      note: "Seed payment marked as paid.",
      order_id: orderId,
      payload: { seeded: true },
    });
  }

  if (scenario.fulfillmentStatus !== "unfulfilled") {
    events.push({
      actor: "admin",
      event_type: "fulfillment_status_updated",
      note: scenario.label,
      order_id: orderId,
      payload: {
        fulfillmentStatus: scenario.fulfillmentStatus,
        seeded: true,
      },
    });
  }

  const { error } = await supabase.from("shop_order_events").insert(events);

  if (error) {
    throw new Error(`Failed to insert events: ${error.message}`);
  }
}

async function insertNotificationJobs({
  email,
  orderId,
  orderNumber,
  phone,
  scenario,
}) {
  const templates = ["order_received"];

  if (scenario.paymentStatus === "paid") {
    templates.push("payment_paid");
  } else if (scenario.paymentStatus === "failed") {
    templates.push("payment_attention");
  }

  const fulfillmentTemplate = templateForFulfillmentStatus(
    scenario.fulfillmentStatus,
  );

  if (fulfillmentTemplate) {
    templates.push(fulfillmentTemplate);
  }

  const rows = templates.flatMap((template) => [
    {
      channel: "email",
      order_id: orderId,
      payload: {
        orderNumber,
        seeded: true,
      },
      recipient: email,
      template,
    },
    {
      channel: "kakao",
      order_id: orderId,
      payload: {
        orderNumber,
        seeded: true,
      },
      recipient: phone,
      template,
    },
  ]);

  const { error } = await supabase.from("shop_notification_jobs").insert(rows);

  if (
    error &&
    !(
      error.code === "42P01" ||
      error.message?.includes("shop_notification_jobs") ||
      error.message?.includes("schema cache")
    )
  ) {
    throw new Error(`Failed to insert notification jobs: ${error.message}`);
  }
}

function templateForFulfillmentStatus(status) {
  return {
    canceled: "order_canceled",
    delivered: "fulfillment_delivered",
    picked_up: "picked_up",
    pickup_ready: "pickup_ready",
    preparing: "fulfillment_preparing",
    returned: "order_canceled",
    shipped: "fulfillment_shipped",
    unfulfilled: null,
  }[status];
}

function hashLookupPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");

  return `scrypt$${salt}$${hash}`;
}

function minutesAfter(minutes) {
  return new Date(baseDate.getTime() + minutes * 60_000).toISOString();
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();

    if (process.env[key]) {
      continue;
    }

    process.env[key] = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  }
}
