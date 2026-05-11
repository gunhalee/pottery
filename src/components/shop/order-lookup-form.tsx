"use client";

import { useState } from "react";
import type { OrderLookupResult } from "@/lib/orders/order-model";

type LookupCredentials = {
  orderNumber: string;
  password: string;
  phoneLast4: string;
};

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      credentials: LookupCredentials;
      kind: "success";
      result: OrderLookupResult;
    };

type RefundState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function OrderLookupForm() {
  const [state, setState] = useState<LookupState>({ kind: "idle" });

  async function lookupOrder(formData: FormData) {
    setState({ kind: "loading" });

    const credentials = {
      orderNumber: String(formData.get("orderNumber") ?? ""),
      password: String(formData.get("password") ?? ""),
      phoneLast4: String(formData.get("phoneLast4") ?? ""),
    };

    try {
      const response = await fetch("/api/orders/lookup", {
        body: JSON.stringify(credentials),
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

      setState({
        credentials,
        kind: "success",
        result: payload as OrderLookupResult,
      });
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
          <span>연락처 뒤 4자리</span>
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
  const [refundState, setRefundState] = useState<RefundState>({
    kind: "idle",
  });

  if (state.kind === "idle") {
    return (
      <aside className="order-lookup-empty">
        <strong>
          주문번호, 연락처 뒤 4자리, 주문 비밀번호가 일치할 때만 결과가
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
  const credentials = state.credentials;

  async function submitRefundAccount(formData: FormData) {
    setRefundState({ kind: "submitting" });

    try {
      const response = await fetch("/api/orders/refund-account", {
        body: JSON.stringify({
          ...credentials,
          accountHolder: String(formData.get("accountHolder") ?? ""),
          accountNumber: String(formData.get("accountNumber") ?? ""),
          bankName: String(formData.get("bankName") ?? ""),
          depositorName: String(formData.get("depositorName") ?? ""),
          refundAmount: normalizeNumber(formData.get("refundAmount")),
          refundReason: String(formData.get("refundReason") ?? ""),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "환불계좌 저장 중 오류가 발생했습니다.",
        );
      }

      setRefundState({
        kind: "success",
        message: "환불계좌를 접수했습니다. 확인 후 처리됩니다.",
      });
    } catch (error) {
      setRefundState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "환불계좌 저장 중 오류가 발생했습니다.",
      });
    }
  }

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
          <dt>결제수단</dt>
          <dd>{paymentMethodLabel(result.paymentMethod)}</dd>
        </div>
        <div>
          <dt>받는 분</dt>
          <dd>{result.recipientName ?? "확인 중"}</dd>
        </div>
      </dl>

      {result.paymentMethod === "bank_transfer" ? (
        <div className="order-lookup-bank">
          <strong>무통장입금 안내</strong>
          <dl>
            <div>
              <dt>입금 계좌</dt>
              <dd>
                {result.bankTransferAccount
                  ? `${result.bankTransferAccount.bankName} ${result.bankTransferAccount.accountNumber} / ${result.bankTransferAccount.accountHolder}`
                  : "확인 중"}
              </dd>
            </div>
            <div>
              <dt>입금 기한</dt>
              <dd>{formatDate(result.depositDueAt)}</dd>
            </div>
            <div>
              <dt>입금 확인</dt>
              <dd>{formatDate(result.depositConfirmedAt)}</dd>
            </div>
            <div>
              <dt>현금영수증</dt>
              <dd>{cashReceiptStatusLabel(result.cashReceiptStatus)}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {result.isMadeToOrder ? (
        <div className="order-lookup-bank">
          <strong>추가 제작 주문</strong>
          <p>
            결제 또는 입금 확인일 기준 약 {result.madeToOrderDueMinDays ?? 30}~
            {result.madeToOrderDueMaxDays ?? 45}일이 소요될 수 있습니다.
          </p>
        </div>
      ) : null}

      {result.items.length > 0 ? (
        <div className="order-lookup-items">
          {result.items.map((item, index) => (
            <div key={`${item.name}-${index}`}>
              <strong>{item.name}</strong>
              <span>
                {[
                  `${item.quantity}개`,
                  productOptionLabel(item.productOption),
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

      {result.paymentMethod === "bank_transfer" ? (
        <form action={submitRefundAccount} className="order-refund-form">
          <strong>환불계좌 등록</strong>
          <label>
            <span>은행명</span>
            <input name="bankName" required />
          </label>
          <label>
            <span>계좌번호</span>
            <input inputMode="numeric" name="accountNumber" required />
          </label>
          <label>
            <span>예금주명</span>
            <input name="accountHolder" required />
          </label>
          <label>
            <span>입금자명</span>
            <input name="depositorName" />
          </label>
          <label>
            <span>환불 요청 금액</span>
            <input inputMode="numeric" name="refundAmount" />
          </label>
          <label className="order-refund-field-wide">
            <span>환불 사유</span>
            <textarea maxLength={300} name="refundReason" />
          </label>
          <p>
            다른 명의 계좌도 접수할 수 있으나, 운영자가 추가 확인한 뒤
            환불합니다. 현재 상태:{" "}
            {refundAccountStatusLabel(result.refundAccountStatus)}
          </p>
          <button
            className="button-primary"
            disabled={refundState.kind === "submitting"}
          >
            {refundState.kind === "submitting" ? "접수 중" : "환불계좌 접수"}
          </button>
          {refundState.kind === "success" || refundState.kind === "error" ? (
            <p className={refundState.kind === "error" ? "checkout-error" : ""}>
              {refundState.message}
            </p>
          ) : null}
        </form>
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

function formatCurrency(value: number) {
  return `${new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0,
  }).format(value)}원`;
}

function normalizeNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").replace(/\D/g, "");
  const parsed = Number(normalized);

  return Number.isFinite(parsed) && normalized ? parsed : undefined;
}

function orderStatusLabel(status: OrderLookupResult["orderStatus"]) {
  return {
    canceled: "주문 취소",
    delivered: "배송 완료",
    deposit_expired: "입금기한 만료",
    draft: "주문 작성 중",
    paid: "결제 완료",
    pending_payment: "결제 대기",
    preparing: "배송 준비",
    refund_pending: "환불 대기",
    refunded: "환불 완료",
    shipped: "배송 중",
  }[status];
}

function paymentStatusLabel(status: OrderLookupResult["paymentStatus"]) {
  return {
    canceled: "결제 취소",
    expired: "입금기한 만료",
    failed: "결제 실패",
    paid: "결제 완료",
    partial_refunded: "부분 환불",
    pending: "결제 확인 중",
    refund_pending: "환불 대기",
    refunded: "환불 완료",
    unpaid: "미결제",
  }[status];
}

function paymentMethodLabel(status: OrderLookupResult["paymentMethod"]) {
  return {
    bank_transfer: "무통장입금",
    naver_pay: "N pay",
    portone: "카드·간편결제",
  }[status];
}

function cashReceiptStatusLabel(status: OrderLookupResult["cashReceiptStatus"]) {
  return {
    canceled: "취소",
    failed: "발급 실패",
    issued: "발급 완료",
    not_requested: "신청 안 함",
    pending: "발급 대기",
    requested: "신청",
  }[status];
}

function refundAccountStatusLabel(
  status: OrderLookupResult["refundAccountStatus"],
) {
  return {
    confirmed: "확인 완료",
    needs_review: "추가 확인 중",
    none: "미등록",
    refunded: "환불 완료",
    rejected: "반려",
  }[status];
}

function productOptionLabel(option: OrderLookupResult["items"][number]["productOption"]) {
  return option === "plant_included"
    ? "식물 포함"
    : option === "plant_excluded"
      ? "식물 제외"
      : null;
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
