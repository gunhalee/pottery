"use client";

import { useState } from "react";
import type { Cafe24OrderLookupResult } from "@/lib/cafe24/order-lookup";

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; result: Cafe24OrderLookupResult };

export function OrderLookupForm() {
  const [state, setState] = useState<LookupState>({ kind: "idle" });

  async function lookupOrder(formData: FormData) {
    setState({ kind: "loading" });

    try {
      const response = await fetch("/api/orders/lookup", {
        body: JSON.stringify({
          buyerName: String(formData.get("buyerName") ?? ""),
          email: String(formData.get("email") ?? ""),
          orderId: String(formData.get("orderId") ?? ""),
          phone: String(formData.get("phone") ?? ""),
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

      setState({ kind: "success", result: payload as Cafe24OrderLookupResult });
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
          <input name="orderId" required placeholder="20260506-0000000" />
        </label>
        <label>
          <span>주문자명</span>
          <input name="buyerName" autoComplete="name" />
        </label>
        <label>
          <span>휴대폰 뒤 4자리</span>
          <input
            inputMode="numeric"
            maxLength={4}
            name="phone"
            pattern="[0-9]{4}"
            placeholder="1234"
          />
        </label>
        <label>
          <span>이메일</span>
          <input name="email" type="email" autoComplete="email" />
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
        <strong>주문번호와 연락처가 일치할 때만 결과가 표시됩니다.</strong>
        <p>Cafe24 주문 정보를 기준으로 결제와 배송 상태를 확인합니다.</p>
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
        <span>{result.orderId}</span>
        <strong>{result.shippingSummary}</strong>
      </div>
      <dl>
        <div>
          <dt>주문일</dt>
          <dd>{formatDate(result.orderDate)}</dd>
        </div>
        <div>
          <dt>주문 상태</dt>
          <dd>{result.orderStatus ?? "확인 중"}</dd>
        </div>
        <div>
          <dt>결제 상태</dt>
          <dd>{result.paymentStatus ?? "확인 중"}</dd>
        </div>
        <div>
          <dt>받는 분</dt>
          <dd>{result.receiverName ?? result.buyerName ?? "확인 중"}</dd>
        </div>
      </dl>
      {result.items.length > 0 ? (
        <div className="order-lookup-items">
          {result.items.map((item, index) => (
            <div key={`${item.name}-${index}`}>
              <strong>{item.name}</strong>
              <span>
                {[
                  item.option,
                  item.quantity ? `${item.quantity}개` : null,
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
            <div key={`${shipment.invoiceNo ?? index}`}>
              <strong>{shipment.carrier ?? "배송사 확인 중"}</strong>
              <span>{shipment.invoiceNo ?? shipment.status ?? "송장 준비 중"}</span>
              {shipment.trackingUrl ? (
                <a href={shipment.trackingUrl} rel="noopener noreferrer" target="_blank">
                  배송 추적
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
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
