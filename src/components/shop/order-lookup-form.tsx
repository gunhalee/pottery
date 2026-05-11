"use client";

import { useState } from "react";
import type { OrderLookupResult } from "@/lib/orders/order-model";

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; result: OrderLookupResult };

export function OrderLookupForm() {
  const [state, setState] = useState<LookupState>({ kind: "idle" });

  async function lookupOrder(formData: FormData) {
    setState({ kind: "loading" });

    try {
      const response = await fetch("/api/orders/lookup", {
        body: JSON.stringify({
          orderNumber: String(formData.get("orderNumber") ?? ""),
          password: String(formData.get("password") ?? ""),
          phoneLast4: String(formData.get("phoneLast4") ?? ""),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "주문 정보를 확인하지 못했습니다.",
        );
      }

      setState({ kind: "success", result: payload as OrderLookupResult });
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "주문 조회 중 오류가 발생했습니다.",
      });
    }
  }

  return (
    <div className="order-lookup-layout">
      <form action={lookupOrder} className="order-lookup-form">
        <label>
          <span>주문번호</span>
          <input
            name="orderNumber"
            placeholder="CP-20260510-123456"
            required
          />
        </label>
        <label>
          <span>연락처 끝 4자리</span>
          <input
            inputMode="numeric"
            maxLength={4}
            name="phoneLast4"
            pattern="[0-9]{4}"
            placeholder="1234"
            required
          />
        </label>
        <label>
          <span>주문 비밀번호</span>
          <input
            autoComplete="off"
            inputMode="numeric"
            maxLength={4}
            name="password"
            pattern="[0-9]{4}"
            placeholder="0000"
            required
            type="password"
          />
        </label>
        <button className="button-primary" disabled={state.kind === "loading"}>
          {state.kind === "loading" ? "조회 중" : "주문 조회"}
        </button>
      </form>

      <OrderLookupResultPanel state={state} />
    </div>
  );
}

function OrderLookupResultPanel({ state }: { state: LookupState }) {
  if (state.kind === "idle") {
    return (
      <aside className="order-lookup-empty">
        <strong>
          주문번호, 연락처 끝 4자리, 주문 비밀번호가 일치할 때만 결과가
          표시됩니다.
        </strong>
        <p>결제 상태와 배송 상태는 자체 주문 기록을 기준으로 확인합니다.</p>
      </aside>
    );
  }

  if (state.kind === "loading") {
    return (
      <aside className="order-lookup-empty">
        <strong>주문 정보를 확인하고 있습니다.</strong>
      </aside>
    );
  }

  if (state.kind === "error") {
    return (
      <aside className="order-lookup-empty order-lookup-error">
        <strong>{state.message}</strong>
      </aside>
    );
  }

  const result = state.result;

  return (
    <aside className="order-lookup-result">
      <div className="order-lookup-result-head">
        <span>{result.orderNumber}</span>
        <strong>{result.shippingSummary}</strong>
      </div>
      <dl>
        <div>
          <dt>주문일</dt>
          <dd>{formatDate(result.createdAt)}</dd>
        </div>
        <div>
          <dt>주문 상태</dt>
          <dd>{orderStatusLabel(result.orderStatus)}</dd>
        </div>
        <div>
          <dt>결제 상태</dt>
          <dd>{paymentStatusLabel(result.paymentStatus)}</dd>
        </div>
        <div>
          <dt>받는 분</dt>
          <dd>{result.recipientName ?? "확인 중"}</dd>
        </div>
      </dl>
      {result.items.length > 0 ? (
        <div className="order-lookup-items">
          {result.items.map((item, index) => (
            <div key={`${item.name}-${index}`}>
              <strong>{item.name}</strong>
              <span>
                {[
                  `${item.quantity}개`,
                  `${formatCurrency(item.lineTotal)}`,
                  item.status,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {result.shipments.length > 0 ? (
        <div className="order-lookup-shipments">
          {result.shipments.map((shipment, index) => (
            <div key={`${shipment.trackingNumber ?? index}`}>
              <strong>{shipment.carrier ?? "배송사 확인 중"}</strong>
              <span>
                {shipment.trackingNumber ??
                  shipmentStatusLabel(shipment.status) ??
                  "송장 준비 중"}
              </span>
              {shipment.trackingUrl ? (
                <a
                  href={shipment.trackingUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  배송 추적
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      <div className="order-lookup-items">
        <div>
          <strong>총 결제금액</strong>
          <span>
            상품 {formatCurrency(result.subtotal)} · 배송비{" "}
            {formatCurrency(result.shippingFee)} · 합계{" "}
            {formatCurrency(result.total)}
          </span>
        </div>
      </div>
    </aside>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "확인 중";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatCurrency(value: number) {
  return `${new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0,
  }).format(value)}원`;
}

function orderStatusLabel(status: OrderLookupResult["orderStatus"]) {
  return {
    canceled: "주문 취소",
    delivered: "배송 완료",
    draft: "주문 작성 중",
    paid: "결제 완료",
    pending_payment: "결제 대기",
    preparing: "배송 준비",
    refunded: "환불 완료",
    shipped: "배송 중",
  }[status];
}

function paymentStatusLabel(status: OrderLookupResult["paymentStatus"]) {
  return {
    canceled: "결제 취소",
    failed: "결제 실패",
    paid: "결제 완료",
    partial_refunded: "부분 환불",
    pending: "결제 확인 중",
    refunded: "환불 완료",
    unpaid: "미결제",
  }[status];
}

function shipmentStatusLabel(status: string) {
  return {
    canceled: "배송 취소",
    delivered: "배송 완료",
    preparing: "배송 준비",
    returned: "반품 처리",
    shipped: "배송 중",
  }[status as "canceled" | "delivered" | "preparing" | "returned" | "shipped"];
}
