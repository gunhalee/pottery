import type {
  AdminOrderListItem,
  AdminOrderStats,
  AdminOrderView,
} from "@/lib/admin/orders";

const adminOrderViews: AdminOrderView[] = [
  "all",
  "needs_action",
  "payment",
  "pickup",
  "shipped",
  "done",
  "issues",
];

export const emptyAdminOrderStats: AdminOrderStats = {
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

export function normalizeAdminOrderSearchQuery(query: string | undefined) {
  return (query ?? "").trim().slice(0, 80);
}

export function buildAdminOrderStats(
  orders: AdminOrderListItem[],
): AdminOrderStats {
  return orders.reduce<AdminOrderStats>(
    (stats, order) => ({
      all: stats.all + 1,
      done: stats.done + (matchesOrderView(order, "done") ? 1 : 0),
      issues: stats.issues + (matchesOrderView(order, "issues") ? 1 : 0),
      needsAction:
        stats.needsAction + (matchesOrderView(order, "needs_action") ? 1 : 0),
      payment: stats.payment + (matchesOrderView(order, "payment") ? 1 : 0),
      pickup: stats.pickup + (matchesOrderView(order, "pickup") ? 1 : 0),
      shipped: stats.shipped + (matchesOrderView(order, "shipped") ? 1 : 0),
    }),
    emptyAdminOrderStats,
  );
}

export function filterAdminOrders({
  orders,
  query,
  view,
}: {
  orders: AdminOrderListItem[];
  query: string;
  view: AdminOrderView;
}) {
  return orders
    .filter((order) => matchesOrderView(order, view))
    .filter((order) => matchesOrderSearch(order, query))
    .sort(compareAdminOrders);
}

function matchesOrderView(order: AdminOrderListItem, view: AdminOrderView) {
  if (view === "all") {
    return true;
  }

  if (view === "needs_action") {
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

  return true;
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

function isAdminOrderView(value: string | undefined): value is AdminOrderView {
  return Boolean(
    value && adminOrderViews.includes(value as AdminOrderView),
  );
}
