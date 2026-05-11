import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  getAdminOrderDashboard,
  type AdminOrderListItem,
  type AdminOrderView,
} from "@/lib/admin/orders";
import type { FulfillmentStatus, PaymentStatus } from "@/lib/orders/order-model";

type AdminOrdersPageProps = {
  searchParams: Promise<{
    q?: string;
    view?: string;
  }>;
};

export const metadata = {
  title: "Order Admin",
};

const viewLabels: Record<AdminOrderView, string> = {
  all: "전체",
  done: "완료",
  issues: "이슈",
  needs_action: "처리 필요",
  payment: "결제 대기",
  pickup: "방문수령",
  shipped: "배송중",
};

export default async function AdminOrdersPage({
  searchParams,
}: AdminOrdersPageProps) {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect("/admin/login?next=/admin/orders");
  }

  const params = await searchParams;
  const dashboard = await getAdminOrderDashboard({
    query: params.q,
    view: params.view,
  });
  const tabs = [
    ["all", dashboard.stats.all],
    ["needs_action", dashboard.stats.needsAction],
    ["payment", dashboard.stats.payment],
    ["pickup", dashboard.stats.pickup],
    ["shipped", dashboard.stats.shipped],
    ["issues", dashboard.stats.issues],
    ["done", dashboard.stats.done],
  ] as const;

  return (
    <main className="admin-page admin-orders-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Consepot Admin</p>
          <h1>주문 관리</h1>
          <p>
            주문번호, 고객, 상품, 결제와 배송 상태를 한 화면에서 확인하고
            오늘 처리할 주문을 먼저 정리합니다.
          </p>
        </div>
        <AdminNav />
      </header>

      {!dashboard.storageReady ? (
        <div className="admin-alert admin-alert-warning">
          주문 테이블 또는 Supabase 환경변수가 아직 준비되지 않았습니다.
          주문 DB 연결 후 이 화면에서 접수된 주문을 처리할 수 있습니다.
        </div>
      ) : null}

      <section className="admin-order-stats" aria-label="주문 처리 요약">
        <OrderStatCard label="처리 필요" value={dashboard.stats.needsAction} />
        <OrderStatCard label="결제 대기" value={dashboard.stats.payment} />
        <OrderStatCard label="배송중" value={dashboard.stats.shipped} />
        <OrderStatCard
          label="이슈"
          tone={dashboard.stats.issues > 0 ? "danger" : "neutral"}
          value={dashboard.stats.issues}
        />
      </section>

      <section className="admin-panel admin-order-workbench">
        <div className="admin-order-toolbar">
          <div>
            <h2>주문 처리함</h2>
            <p>처리가 필요한 주문이 먼저 보이도록 정렬됩니다.</p>
          </div>
          <form action="/admin/orders" className="admin-order-search">
            {dashboard.activeView !== "all" ? (
              <input name="view" type="hidden" value={dashboard.activeView} />
            ) : null}
            <label>
              <span className="sr-only">주문 검색</span>
              <input
                defaultValue={dashboard.query}
                name="q"
                placeholder="주문번호, 고객, 이메일, 상품, 송장"
                type="search"
              />
            </label>
            <button className="admin-secondary-button" type="submit">
              검색
            </button>
          </form>
        </div>

        <nav className="admin-order-view-tabs" aria-label="주문 보기">
          {tabs.map(([view, count]) => (
            <Link
              aria-current={dashboard.activeView === view ? "page" : undefined}
              className={
                dashboard.activeView === view
                  ? "admin-order-view-tab admin-order-view-tab-active"
                  : "admin-order-view-tab"
              }
              href={orderViewHref(view, dashboard.query)}
              key={view}
              prefetch={false}
            >
              <span>{viewLabels[view]}</span>
              <b>{count}</b>
            </Link>
          ))}
        </nav>

        {dashboard.orders.length > 0 ? (
          <div className="admin-order-list">
            <div className="admin-order-list-head" aria-hidden="true">
              <span>주문</span>
              <span>고객</span>
              <span>처리 상태</span>
              <span>금액</span>
              <span>다음 처리</span>
            </div>
            {dashboard.orders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
        ) : (
          <div className="admin-order-empty">
            <strong>
              {dashboard.storageReady
                ? "조건에 맞는 주문이 없습니다."
                : "아직 주문을 불러올 수 없습니다."}
            </strong>
            <p>
              {dashboard.query || dashboard.activeView !== "all"
                ? "검색어 또는 필터를 바꾸면 다른 주문을 확인할 수 있습니다."
                : "주문이 접수되면 이곳에 결제와 배송 처리 상태가 표시됩니다."}
            </p>
            {dashboard.query || dashboard.activeView !== "all" ? (
              <Link className="admin-text-button" href="/admin/orders" prefetch={false}>
                전체 주문 보기
              </Link>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}

function OrderStatCard({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "danger" | "neutral";
  value: number;
}) {
  return (
    <article
      className={`admin-order-stat ${
        tone === "danger" ? "admin-order-stat-danger" : ""
      }`}
    >
      <span>{label}</span>
      <strong>{value.toLocaleString("ko-KR")}</strong>
    </article>
  );
}

function OrderRow({ order }: { order: AdminOrderListItem }) {
  return (
    <article className={`admin-order-row admin-order-row-${order.tone}`}>
      <div className="admin-order-main-cell">
        <Link href={`/admin/orders/${order.id}`} prefetch={false}>
          <strong>{order.orderNumber}</strong>
        </Link>
        <span>
          {order.itemSummary}
          {order.quantityTotal > 0 ? ` · ${order.quantityTotal}개` : ""}
        </span>
        <small>{order.ageLabel}</small>
      </div>
      <div>
        <strong>{order.ordererName}</strong>
        <span>끝 {order.ordererPhoneLast4}</span>
        <small>{order.recipientName ? `받는 분 ${order.recipientName}` : "주문자 수령"}</small>
      </div>
      <div className="admin-order-status-stack">
        <StatusPill label={paymentStatusLabel(order.paymentStatus)} tone="payment" />
        <StatusPill
          label={fulfillmentStatusLabel(order.fulfillmentStatus)}
          tone="fulfillment"
        />
        <small>
          {order.paymentMethod === "bank_transfer" ? "무통장입금 · " : ""}
          {order.shippingMethod === "pickup" ? "방문수령" : "택배"}
        </small>
      </div>
      <div className="admin-order-price-cell">
        <strong>{formatMoney(order.totalKrw)}</strong>
        {order.paidAt ? <small>결제 완료</small> : <small>결제 전</small>}
      </div>
      <div className="admin-order-action-cell">
        <span className={`admin-order-action admin-order-action-${order.tone}`}>
          {order.actionLabel}
        </span>
        <Link className="admin-text-button" href={`/admin/orders/${order.id}`} prefetch={false}>
          열기
        </Link>
      </div>
    </article>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "fulfillment" | "payment";
}) {
  return (
    <span className={`admin-order-pill admin-order-pill-${tone}`}>{label}</span>
  );
}

function orderViewHref(view: AdminOrderView, query: string) {
  const params = new URLSearchParams();

  if (view !== "all") {
    params.set("view", view);
  }

  if (query) {
    params.set("q", query);
  }

  const suffix = params.toString();
  return suffix ? `/admin/orders?${suffix}` : "/admin/orders";
}

function paymentStatusLabel(status: PaymentStatus) {
  return {
    canceled: "결제 취소",
    expired: "입금기한 만료",
    failed: "결제 실패",
    paid: "결제 완료",
    partial_refunded: "부분 환불",
    pending: "결제 대기",
    refund_pending: "환불 대기",
    refunded: "환불 완료",
    unpaid: "미결제",
  }[status];
}

function fulfillmentStatusLabel(status: FulfillmentStatus) {
  return {
    canceled: "취소",
    delivered: "배송 완료",
    picked_up: "수령 완료",
    pickup_ready: "수령 가능",
    preparing: "준비중",
    returned: "반품",
    shipped: "배송중",
    unfulfilled: "처리 전",
  }[status];
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}
