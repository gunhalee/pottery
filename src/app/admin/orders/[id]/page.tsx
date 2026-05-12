import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import {
  getAdminOrderDetail,
  type AdminCashReceipt,
  type AdminOrderDetail,
  type AdminOrderEvent,
  type AdminOrderNotification,
  type AdminOrderPayment,
  type AdminOrderShipment,
  type AdminRefundAccount,
} from "@/lib/admin/orders";
import type {
  FulfillmentStatus,
  PaymentMethod,
  PaymentStatus,
} from "@/lib/orders/order-model";
import {
  syncAdminPortOnePaymentAction,
  updateAdminOrderFulfillmentAction,
  updateAdminRefundAccountAction,
} from "../actions";

type AdminOrderDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
  }>;
};

export const metadata = {
  title: "Order Detail Admin",
};

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: AdminOrderDetailPageProps) {
  const { id } = await params;
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    redirect(`/admin/login?next=${encodeURIComponent(`/admin/orders/${id}`)}`);
  }

  const [flags, order] = await Promise.all([
    searchParams,
    getAdminOrderDetail(id),
  ]);

  if (!order) {
    notFound();
  }

  const fulfillmentEditable = order.paymentStatus === "paid";
  const parcelShipping = order.shippingMethod === "parcel";
  const showBackwardConfirmation = needsBackwardFulfillmentConfirmation(
    order.fulfillmentStatus,
  );

  return (
    <main className="admin-page admin-order-detail-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Consepot Admin</p>
          <h1>{order.orderNumber}</h1>
          <p>
            주문자, 상품, 결제 상태와 배송/방문수령 처리 내역을 확인합니다.
          </p>
        </div>
        <div className="admin-header-actions">
          <Link className="admin-text-button" href="/admin/orders" prefetch={false}>
            목록
          </Link>
          <AdminNav />
        </div>
      </header>

      {flags.saved ? (
        <div className="admin-alert">주문 처리 상태를 저장했습니다.</div>
      ) : null}
      {flags.error ? (
        <div className="admin-alert admin-alert-danger">
          주문 처리 상태를 저장하지 못했습니다. 입력값과 DB 연결 상태를
          확인해주세요.
        </div>
      ) : null}

      <section className="admin-order-detail-hero">
        <div>
          <span className="admin-order-action admin-order-action-priority">
            {primaryActionLabel(order)}
          </span>
          <h2>{order.items[0]?.productTitle ?? "상품 정보 없음"}</h2>
          <p>
            {order.ordererName} · {order.shippingMethod === "pickup" ? "방문수령" : "택배"} ·{" "}
            {formatDateTime(order.createdAt)}
          </p>
        </div>
        <div className="admin-order-detail-total">
          <span>총 결제금액</span>
          <strong>{formatMoney(order.totalKrw)}</strong>
          <small>{paymentStatusLabel(order.paymentStatus)}</small>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>결제·주문 옵션</h2>
          <span>{paymentMethodLabel(order.paymentMethod)}</span>
        </div>
        <dl className="admin-order-info-list">
          <div>
            <dt>상품 옵션</dt>
            <dd>
              {order.productOption === "plant_included"
                ? "식물 포함"
                : "식물 제외"}
            </dd>
          </div>
          <div>
            <dt>생화·식물</dt>
            <dd>{order.containsLivePlant ? "포함" : "미포함"}</dd>
          </div>
          <div>
            <dt>추가 제작</dt>
            <dd>
              {order.isMadeToOrder
                ? `약 ${order.madeToOrderDueMinDays ?? 30}~${order.madeToOrderDueMaxDays ?? 45}일`
                : "아님"}
            </dd>
          </div>
          <div>
            <dt>현금영수증</dt>
            <dd>{cashReceiptStatusLabel(order.cashReceiptStatus)}</dd>
          </div>
        </dl>
      </section>

      {isPortOnePaymentMethod(order.paymentMethod) ? (
        <PortOnePaymentPanel order={order} />
      ) : null}

      {order.cashReceiptType || order.cashReceipts.length > 0 ? (
        <CashReceiptPanel order={order} records={order.cashReceipts} />
      ) : null}

      {requiresRefundAccountFallback(order.paymentMethod) ? (
        <RefundAccountsPanel
          orderId={order.id}
          records={order.refundAccounts}
        />
      ) : null}

      <div className="admin-order-detail-grid">
        <section className="admin-panel admin-order-update-panel">
          <div className="admin-panel-head">
            <h2>배송/수령 처리</h2>
            <span>{fulfillmentStatusLabel(order.fulfillmentStatus)}</span>
          </div>
          {!fulfillmentEditable ? (
            <div className="admin-alert admin-alert-warning">
              결제 완료 전 주문은 배송/수령 상태를 변경할 수 없습니다.
            </div>
          ) : null}
          <form action={updateAdminOrderFulfillmentAction} className="admin-form">
            <input name="orderId" type="hidden" value={order.id} />
            <label>
              <span>처리 상태</span>
              <select
                defaultValue={order.fulfillmentStatus}
                disabled={!fulfillmentEditable}
                name="fulfillmentStatus"
                required
              >
                {fulfillmentOptions(order.shippingMethod).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {parcelShipping ? (
              <>
                <div className="admin-form-grid">
                  <label>
                    <span>택배사</span>
                    <input
                      defaultValue={order.latestShipment?.carrier ?? ""}
                      disabled={!fulfillmentEditable}
                      name="carrier"
                      placeholder="계약 택배사"
                    />
                  </label>
                  <label>
                    <span>송장번호</span>
                    <input
                      defaultValue={order.latestShipment?.trackingNumber ?? ""}
                      disabled={!fulfillmentEditable}
                      name="trackingNumber"
                      placeholder="송장번호"
                    />
                  </label>
                </div>
                <label>
                  <span>배송 조회 URL</span>
                  <input
                    defaultValue={order.latestShipment?.trackingUrl ?? ""}
                    disabled={!fulfillmentEditable}
                    name="trackingUrl"
                    placeholder="https://"
                    type="url"
                  />
                </label>
              </>
            ) : (
              <p className="admin-empty-text">
                방문수령 주문은 송장 정보를 입력하지 않습니다.
              </p>
            )}
            {showBackwardConfirmation && fulfillmentEditable ? (
              <label>
                <span>이전 단계 확인</span>
                <span className="admin-check-row">
                  <label>
                    <input
                      name="allowBackwardFulfillment"
                      type="checkbox"
                      value="1"
                    />
                    상태를 이전 단계로 되돌리는 작업임을 확인했습니다.
                  </label>
                </span>
              </label>
            ) : null}
            <label>
              <span>처리 메모</span>
              <textarea
                disabled={!fulfillmentEditable}
                name="note"
                placeholder="고객 안내 또는 내부 확인 내용을 남깁니다."
                rows={4}
              />
            </label>
            <button
              className="button-primary"
              disabled={!fulfillmentEditable}
              type="submit"
            >
              처리 상태 저장
            </button>
            {!fulfillmentEditable ? (
              <input
                name="fulfillmentStatus"
                type="hidden"
                value={order.fulfillmentStatus}
              />
            ) : null}
            {!parcelShipping ? (
              <>
                <input
                  name="carrier"
                  type="hidden"
                  value=""
                />
                <input
                  name="trackingNumber"
                  type="hidden"
                  value=""
                />
                <input
                  name="trackingUrl"
                  type="hidden"
                  value=""
                />
              </>
            ) : null}
          </form>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head">
            <h2>고객/수령 정보</h2>
            <span>{order.ordererPhoneLast4}</span>
          </div>
          <dl className="admin-order-info-list">
            <div>
              <dt>주문자</dt>
              <dd>{order.ordererName}</dd>
            </div>
            <div>
              <dt>연락처</dt>
              <dd>{formatPhone(order.ordererPhone)}</dd>
            </div>
            <div>
              <dt>이메일</dt>
              <dd>{order.ordererEmail}</dd>
            </div>
            <div>
              <dt>수령자</dt>
              <dd>{order.recipientName ?? order.ordererName}</dd>
            </div>
            <div>
              <dt>배송지</dt>
              <dd>{shippingAddress(order)}</dd>
            </div>
            {order.shippingMemo ? (
              <div>
                <dt>배송 메모</dt>
                <dd>{order.shippingMemo}</dd>
              </div>
            ) : null}
            {order.isGift ? (
              <div>
                <dt>선물 메시지</dt>
                <dd>{order.giftMessage || "메시지 없음"}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>주문 상품</h2>
          <span>{order.items.length} items</span>
        </div>
        <div className="admin-order-items">
          {order.items.map((item) => (
            <article key={`${item.productSlug}-${item.productTitle}`}>
              <div>
                <strong>{item.productTitle}</strong>
                <span>/{item.productSlug}</span>
              </div>
              <span>{formatMoney(item.unitPriceKrw)}</span>
              <span>{item.quantity}개</span>
              <strong>{formatMoney(item.lineTotalKrw)}</strong>
            </article>
          ))}
        </div>
        <dl className="admin-order-total-list">
          <div>
            <dt>상품금액</dt>
            <dd>{formatMoney(order.subtotalKrw)}</dd>
          </div>
          <div>
            <dt>배송비</dt>
            <dd>{formatMoney(order.shippingFeeKrw)}</dd>
          </div>
          <div>
            <dt>총 결제금액</dt>
            <dd>{formatMoney(order.totalKrw)}</dd>
          </div>
        </dl>
      </section>

      <div className="admin-order-detail-grid">
        <OrderRecordsPanel
          emptyText="결제 기록이 아직 없습니다."
          records={order.payments}
          title="결제 기록"
        />
        <ShipmentRecordsPanel shipments={order.shipments} />
      </div>

      <NotificationRecordsPanel notifications={order.notifications} />

      <section className="admin-panel">
        <div className="admin-panel-head">
          <h2>처리 기록</h2>
          <span>{order.events.length} logs</span>
        </div>
        {order.events.length > 0 ? (
          <div className="admin-order-timeline">
            {order.events.map((event) => (
              <EventRow event={event} key={event.id} />
            ))}
          </div>
        ) : (
          <p className="admin-empty-text">아직 처리 기록이 없습니다.</p>
        )}
      </section>
    </main>
  );
}

function OrderRecordsPanel({
  emptyText,
  records,
  title,
}: {
  emptyText: string;
  records: AdminOrderPayment[];
  title: string;
}) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <h2>{title}</h2>
        <span>{records.length} logs</span>
      </div>
      {records.length > 0 ? (
        <div className="admin-order-record-list">
          {records.map((record) => (
            <article key={record.id}>
              <div>
                <strong>{paymentStatusLabel(record.status)}</strong>
                <span>{record.provider}</span>
              </div>
              <span>{formatMoney(record.amountKrw)}</span>
              <time dateTime={record.createdAt}>{formatDateTime(record.createdAt)}</time>
            </article>
          ))}
        </div>
      ) : (
        <p className="admin-empty-text">{emptyText}</p>
      )}
    </section>
  );
}

function PortOnePaymentPanel({ order }: { order: AdminOrderDetail }) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <h2>PortOne 결제</h2>
        <span>{paymentStatusLabel(order.paymentStatus)}</span>
      </div>
      <dl className="admin-order-info-list">
        <div>
          <dt>결제 ID</dt>
          <dd>{order.portonePaymentId ?? "미발급"}</dd>
        </div>
        <div>
          <dt>거래 ID</dt>
          <dd>{order.portoneTransactionId ?? "미확인"}</dd>
        </div>
        <div>
          <dt>입금 기한</dt>
          <dd>{formatOptionalDateTime(order.depositDueAt)}</dd>
        </div>
        <div>
          <dt>입금 확인</dt>
          <dd>{formatOptionalDateTime(order.depositConfirmedAt)}</dd>
        </div>
        <div>
          <dt>입금액</dt>
          <dd>
            {order.depositReceivedAmountKrw === null
              ? "미확인"
              : formatMoney(order.depositReceivedAmountKrw)}
          </dd>
        </div>
        <div>
          <dt>가상계좌 발급</dt>
          <dd>{formatOptionalDateTime(order.virtualAccountIssuedAt)}</dd>
        </div>
        <div>
          <dt>은행</dt>
          <dd>{order.virtualAccountBankName ?? "미발급"}</dd>
        </div>
        <div>
          <dt>계좌번호</dt>
          <dd>{order.virtualAccountAccountNumber ?? "미발급"}</dd>
        </div>
        <div>
          <dt>예금주</dt>
          <dd>{order.virtualAccountAccountHolder ?? "미발급"}</dd>
        </div>
        <div>
          <dt>메모</dt>
          <dd>{order.depositReviewNote ?? "없음"}</dd>
        </div>
      </dl>
      <form action={syncAdminPortOnePaymentAction} className="admin-inline-form">
        <input name="orderId" type="hidden" value={order.id} />
        <button
          className="button-primary"
          disabled={!order.portonePaymentId}
          type="submit"
        >
          PG 상태 재조회
        </button>
      </form>
    </section>
  );
}

function CashReceiptPanel({
  order,
  records,
}: {
  order: AdminOrderDetail;
  records: AdminCashReceipt[];
}) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <h2>현금영수증</h2>
        <span>{cashReceiptStatusLabel(order.cashReceiptStatus)}</span>
      </div>
      <dl className="admin-order-info-list">
        <div>
          <dt>발급 유형</dt>
          <dd>{cashReceiptTypeLabel(order.cashReceiptType)}</dd>
        </div>
        <div>
          <dt>발급수단</dt>
          <dd>
            {order.cashReceiptIdentifierType
              ? `${cashReceiptIdentifierTypeLabel(order.cashReceiptIdentifierType)} ${order.cashReceiptIdentifierMasked ?? ""}`
              : "신청 안 함"}
          </dd>
        </div>
      </dl>
      {records.length > 0 ? (
        <div className="admin-order-record-list">
          {records.map((record) => (
            <article key={record.id}>
              <div>
                <strong>{cashReceiptRecordStatusLabel(record.status)}</strong>
                <span>
                  {cashReceiptTypeLabel(record.receiptType)} ·{" "}
                  {record.identifierMasked}
                </span>
              </div>
              <span>{formatMoney(record.amountKrw)}</span>
              <time dateTime={record.createdAt}>
                {formatDateTime(record.createdAt)}
              </time>
              {record.errorMessage ? <p>{record.errorMessage}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="admin-empty-text">
          PG 결제 상태가 갱신되면 현금영수증 기록이 함께 반영됩니다.
        </p>
      )}
    </section>
  );
}

function RefundAccountsPanel({
  orderId,
  records,
}: {
  orderId: string;
  records: AdminRefundAccount[];
}) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <h2>환불계좌</h2>
        <span>{records.length} records</span>
      </div>
      {records.length > 0 ? (
        <div className="admin-order-record-list">
          {records.map((record) => (
            <article key={record.id}>
              <div>
                <strong>
                  {record.bankName} {record.accountNumberMasked}
                </strong>
                <span>
                  예금주 {record.accountHolder}
                  {record.depositorName ? ` · 입금자 ${record.depositorName}` : ""}
                </span>
                {record.refundReason ? <p>{record.refundReason}</p> : null}
              </div>
              <span>{refundAccountStatusLabel(record.status)}</span>
              <time dateTime={record.submittedAt}>
                {formatDateTime(record.submittedAt)}
              </time>
              <form
                action={updateAdminRefundAccountAction}
                className="admin-inline-form"
              >
                <input name="orderId" type="hidden" value={orderId} />
                <input name="refundAccountId" type="hidden" value={record.id} />
                <select defaultValue={record.status} name="status">
                  <option value="needs_review">추가 확인 중</option>
                  <option value="confirmed">확인 완료</option>
                  <option value="refunded">환불 완료</option>
                  <option value="rejected">반려</option>
                </select>
                <input
                  defaultValue={record.adminNote ?? ""}
                  name="adminNote"
                  placeholder="관리 메모"
                />
                <button className="admin-secondary-button" type="submit">
                  저장
                </button>
              </form>
            </article>
          ))}
        </div>
      ) : (
        <p className="admin-empty-text">아직 접수된 환불계좌가 없습니다.</p>
      )}
    </section>
  );
}

function ShipmentRecordsPanel({
  shipments,
}: {
  shipments: AdminOrderShipment[];
}) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <h2>배송 기록</h2>
        <span>{shipments.length} logs</span>
      </div>
      {shipments.length > 0 ? (
        <div className="admin-order-record-list">
          {shipments.map((shipment) => (
            <article key={shipment.id}>
              <div>
                <strong>{shipmentStatusLabel(shipment.status)}</strong>
                <span>
                  {[shipment.carrier, shipment.trackingNumber]
                    .filter(Boolean)
                    .join(" ") || "송장 정보 없음"}
                </span>
              </div>
              {shipment.trackingUrl ? (
                <a href={shipment.trackingUrl} rel="noopener noreferrer" target="_blank">
                  조회
                </a>
              ) : (
                <span>-</span>
              )}
              <time dateTime={shipment.createdAt}>
                {formatDateTime(shipment.createdAt)}
              </time>
            </article>
          ))}
        </div>
      ) : (
        <p className="admin-empty-text">아직 배송 기록이 없습니다.</p>
      )}
    </section>
  );
}

function NotificationRecordsPanel({
  notifications,
}: {
  notifications: AdminOrderNotification[];
}) {
  return (
    <section className="admin-panel">
      <div className="admin-panel-head">
        <h2>알림 작업</h2>
        <span>{notifications.length} jobs</span>
      </div>
      {notifications.length > 0 ? (
        <div className="admin-order-record-list">
          {notifications.map((notification) => (
            <article key={notification.id}>
              <div>
                <strong>{notificationTemplateLabel(notification.template)}</strong>
                <span>
                  {notification.channel === "email" ? "이메일" : "카카오"} ·{" "}
                  {notification.recipient ?? "수신처 없음"}
                </span>
              </div>
              <span>{notificationStatusLabel(notification.status)}</span>
              <time dateTime={notification.createdAt}>
                {formatDateTime(notification.createdAt)}
              </time>
            </article>
          ))}
        </div>
      ) : (
        <p className="admin-empty-text">
          아직 알림 작업이 없습니다. 알림 outbox 테이블 준비 후 새 주문부터
          쌓입니다.
        </p>
      )}
    </section>
  );
}

function EventRow({ event }: { event: AdminOrderEvent }) {
  return (
    <article>
      <div>
        <strong>{eventTypeLabel(event.eventType)}</strong>
        <span>{event.actor}</span>
      </div>
      {event.note ? <p>{event.note}</p> : null}
      <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
    </article>
  );
}

function primaryActionLabel(order: AdminOrderDetail) {
  if (order.paymentStatus === "pending" || order.paymentStatus === "unpaid") {
    return "결제 확인 대기";
  }

  if (order.paymentStatus !== "paid") {
    return paymentStatusLabel(order.paymentStatus);
  }

  if (order.shippingMethod === "pickup") {
    return {
      canceled: "취소 처리됨",
      delivered: "완료",
      picked_up: "수령 완료",
      pickup_ready: "수령 가능 안내",
      preparing: "방문수령 준비",
      returned: "반품 처리",
      shipped: "처리 확인",
      unfulfilled: "방문수령 준비",
    }[order.fulfillmentStatus];
  }

  return {
    canceled: "취소 처리됨",
    delivered: "배송 완료",
    picked_up: "완료",
    pickup_ready: "처리 확인",
    preparing: "포장/발송 준비",
    returned: "반품 처리",
    shipped: "배송 추적",
    unfulfilled: "포장/발송 준비",
  }[order.fulfillmentStatus];
}

function needsBackwardFulfillmentConfirmation(status: FulfillmentStatus) {
  return ["delivered", "picked_up", "returned", "canceled"].includes(status);
}

function fulfillmentOptions(shippingMethod: AdminOrderDetail["shippingMethod"]) {
  const parcelOptions: { label: string; value: FulfillmentStatus }[] = [
    { label: "처리 전", value: "unfulfilled" },
    { label: "배송 준비중", value: "preparing" },
    { label: "배송중", value: "shipped" },
    { label: "배송 완료", value: "delivered" },
    { label: "반품", value: "returned" },
    { label: "취소", value: "canceled" },
  ];
  const pickupOptions: { label: string; value: FulfillmentStatus }[] = [
    { label: "처리 전", value: "unfulfilled" },
    { label: "방문수령 준비중", value: "preparing" },
    { label: "수령 가능", value: "pickup_ready" },
    { label: "수령 완료", value: "picked_up" },
    { label: "취소", value: "canceled" },
  ];

  return shippingMethod === "pickup" ? pickupOptions : parcelOptions;
}

function shippingAddress(order: AdminOrderDetail) {
  if (order.shippingMethod === "pickup") {
    return "방문수령";
  }

  return [
    order.shippingPostcode ? `(${order.shippingPostcode})` : null,
    order.shippingAddress1,
    order.shippingAddress2,
  ]
    .filter(Boolean)
    .join(" ") || "배송지 미입력";
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

function paymentMethodLabel(status: PaymentMethod) {
  return {
    naver_pay: "N pay",
    portone_card: "카드·간편결제",
    portone_transfer: "실시간 계좌이체",
    portone_virtual_account: "무통장입금(가상계좌)",
  }[status];
}

function isPortOnePaymentMethod(method: PaymentMethod) {
  return method !== "naver_pay";
}

function requiresRefundAccountFallback(method: PaymentMethod) {
  return (
    method === "portone_transfer" || method === "portone_virtual_account"
  );
}

function cashReceiptStatusLabel(status: AdminOrderDetail["cashReceiptStatus"]) {
  return {
    canceled: "취소",
    failed: "발급 실패",
    issued: "발급 완료",
    not_requested: "신청 안 함",
    pending: "발급 대기",
    requested: "신청",
  }[status];
}

function cashReceiptRecordStatusLabel(status: AdminCashReceipt["status"]) {
  return {
    canceled: "취소",
    failed: "발급 실패",
    issued: "발급 완료",
    pending: "발급 대기",
  }[status];
}

function cashReceiptTypeLabel(
  type: AdminOrderDetail["cashReceiptType"] | AdminCashReceipt["receiptType"],
) {
  if (!type) {
    return "신청 안 함";
  }

  return {
    business: "사업자 지출증빙",
    personal: "개인 소득공제",
  }[type];
}

function cashReceiptIdentifierTypeLabel(
  type: NonNullable<AdminOrderDetail["cashReceiptIdentifierType"]>,
) {
  return {
    business_registration: "사업자등록번호",
    cash_receipt_card: "현금영수증 카드",
    phone: "휴대전화",
  }[type];
}

function refundAccountStatusLabel(status: AdminRefundAccount["status"]) {
  return {
    confirmed: "확인 완료",
    needs_review: "추가 확인 중",
    refunded: "환불 완료",
    rejected: "반려",
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

function shipmentStatusLabel(status: AdminOrderShipment["status"]) {
  return {
    canceled: "취소",
    delivered: "배송 완료",
    preparing: "배송 준비",
    returned: "반품",
    shipped: "배송중",
  }[status];
}

function eventTypeLabel(eventType: string) {
  return {
    cash_receipt_issue_pending: "현금영수증 발급 대기",
    fulfillment_status_updated: "처리 상태 변경",
    inventory_stock_decremented: "재고 차감",
    inventory_stock_released: "재고 확보 해제",
    inventory_stock_reserved: "입금대기 재고 확보",
    inventory_stock_shortfall: "재고 부족 기록",
    order_draft_created: "주문 접수",
    portone_payment_prepared: "결제 요청",
    portone_payment_paid: "결제 완료",
    portone_payment_reverified: "결제 재확인",
    portone_payment_status_updated: "PG 상태 갱신",
    portone_payment_verification_failed: "결제 검증 실패",
    portone_virtual_account_expired: "가상계좌 입금기한 만료",
    portone_virtual_account_issued: "가상계좌 발급",
    refund_account_status_updated: "환불계좌 상태 변경",
    refund_account_submitted: "환불계좌 접수",
  }[eventType] ?? eventType;
}

function notificationTemplateLabel(template: string) {
  return {
    deposit_expired: "입금기한 만료 안내",
    deposit_guide: "입금 안내",
    deposit_reminder: "입금 리마인드",
    fulfillment_delivered: "배송 완료 안내",
    fulfillment_preparing: "배송 준비 안내",
    fulfillment_shipped: "배송 시작 안내",
    made_to_order_confirmed: "추가 제작 확정 안내",
    made_to_order_delay: "제작 지연 안내",
    order_canceled: "취소/반품 안내",
    order_received: "주문 접수 안내",
    payment_attention: "결제 확인 안내",
    payment_paid: "결제 완료 안내",
    picked_up: "수령 완료 안내",
    pickup_ready: "방문수령 안내",
  }[template] ?? template;
}

function notificationStatusLabel(status: AdminOrderNotification["status"]) {
  return {
    failed: "실패",
    pending: "대기",
    sent: "발송 완료",
    skipped: "건너뜀",
  }[status];
}

function formatMoney(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatOptionalDateTime(value: string | null) {
  return value ? formatDateTime(value) : "미확인";
}

function formatPhone(value: string) {
  if (value.length === 11) {
    return `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
  }

  return value;
}
