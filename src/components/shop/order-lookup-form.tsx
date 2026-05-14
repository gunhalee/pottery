"use client";

import { useState } from "react";
import {
  SiteActionButton,
  SiteEmptyState,
} from "@/components/site/actions";
import {
  CommerceFormField,
  CommerceFormStatus,
  CommerceFormStatusMessage,
  CommerceSummaryList,
} from "@/components/site/commerce-form-primitives";
import type { OrderLookupResult } from "@/lib/orders/order-model";

type LookupCredentials = {
  orderNumber: string;
  password: string;
  phoneLast4: string;
};

type LookupRequestCredentials = {
  ordererName: string;
  password: string;
  phoneLast4: string;
};

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      credentials: Pick<LookupCredentials, "password" | "phoneLast4">;
      kind: "success";
      results: OrderLookupResult[];
    };

type RefundState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

type ReturnRequestState = RefundState;
type GiftResendState = RefundState;

export function OrderLookupForm() {
  const [state, setState] = useState<LookupState>({ kind: "idle" });

  async function lookupOrder(formData: FormData) {
    setState({ kind: "loading" });

    const credentials: LookupRequestCredentials = {
      ordererName: String(formData.get("ordererName") ?? ""),
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

      const results = Array.isArray(payload)
        ? (payload as OrderLookupResult[])
        : [];

      if (results.length === 0) {
        throw new Error("조회된 주문이 없습니다.");
      }

      setState({
        credentials: {
          password: credentials.password,
          phoneLast4: credentials.phoneLast4,
        },
        kind: "success",
        results,
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
          <span>주문자 이름</span>
          <input
            autoComplete="name"
            maxLength={40}
            name="ordererName"
            placeholder="홍길동"
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
            data-1p-ignore="true"
            data-bwignore="true"
            data-lpignore="true"
            inputMode="numeric"
            maxLength={4}
            name="password"
            pattern="[0-9]{4}"
            placeholder="0000"
            required
            type="password"
          />
        </label>
        <SiteActionButton disabled={state.kind === "loading"} type="submit">
          {state.kind === "loading" ? "조회 중" : "주문 조회"}
        </SiteActionButton>
      </form>

      <OrderLookupResultPanel state={state} />
    </div>
  );
}

function OrderLookupResultPanel({ state }: { state: LookupState }) {
  if (state.kind === "idle") {
    return (
      <SiteEmptyState
        as="aside"
        className="order-lookup-empty"
        title="주문조회를 위해 정보를 입력해 주세요."
      />
    );
  }

  if (state.kind === "loading") {
    return (
      <SiteEmptyState
        as="aside"
        className="order-lookup-empty"
        title="주문 정보를 확인하고 있습니다."
      />
    );
  }

  if (state.kind === "error") {
    return (
      <SiteEmptyState
        as="aside"
        className="order-lookup-empty order-lookup-error"
        title={state.message}
      />
    );
  }

  return (
    <div className="order-lookup-results">
      {state.results.map((result) => (
        <OrderLookupResultCard
          credentials={{
            orderNumber: result.orderNumber,
            password: state.credentials.password,
            phoneLast4: state.credentials.phoneLast4,
          }}
          key={result.orderNumber}
          result={result}
        />
      ))}
    </div>
  );
}

function OrderLookupResultCard({
  credentials,
  result,
}: {
  credentials: LookupCredentials;
  result: OrderLookupResult;
}) {
  const [refundState, setRefundState] = useState<RefundState>({
    kind: "idle",
  });
  const [returnRequestState, setReturnRequestState] =
    useState<ReturnRequestState>({
      kind: "idle",
    });
  const [giftResendState, setGiftResendState] = useState<GiftResendState>({
    kind: "idle",
  });
  const [isReturnRequestOpen, setIsReturnRequestOpen] = useState(false);
  const [isRefundAccountActive, setIsRefundAccountActive] = useState(false);

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

  async function submitReturnRequest(formData: FormData) {
    setReturnRequestState({ kind: "submitting" });
    formData.set("orderNumber", credentials.orderNumber);
    formData.set("phoneLast4", credentials.phoneLast4);
    formData.set("password", credentials.password);

    try {
      const response = await fetch("/api/orders/return-request", {
        body: formData,
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof payload?.error === "string"
            ? payload.error
            : "교환·반품 문의 접수 중 오류가 발생했습니다.",
        );
      }

      setReturnRequestState({
        kind: "success",
        message:
          typeof payload?.message === "string"
            ? payload.message
            : "교환·반품 문의가 접수되었습니다.",
      });
    } catch (error) {
      setReturnRequestState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "교환·반품 문의 접수 중 오류가 발생했습니다.",
      });
    }
  }

  async function resendGiftAddress(formData: FormData) {
    setGiftResendState({ kind: "submitting" });

    try {
      const response = await fetch("/api/gift-recipient/resend", {
        body: JSON.stringify({
          ...credentials,
          recipientPhoneLast4: String(
            formData.get("recipientPhoneLast4") ?? "",
          ),
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
            : "선물 배송지 입력 링크 재발송 중 오류가 발생했습니다.",
        );
      }

      setGiftResendState({
        kind: "success",
        message:
          typeof payload?.message === "string"
            ? payload.message
            : "기존 선물 배송지 입력 링크를 다시 보냈습니다.",
      });
    } catch (error) {
      setGiftResendState({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "선물 배송지 입력 링크 재발송 중 오류가 발생했습니다.",
      });
    }
  }

  return (
    <aside className="order-lookup-result">
      <div className="order-lookup-result-head">
        <span>{result.orderNumber}</span>
        <strong>{result.shippingSummary}</strong>
      </div>
      <CommerceSummaryList
        items={[
          {
            label: "주문일",
            value: formatDate(result.createdAt),
          },
          {
            label: "주문 상태",
            value: orderStatusLabel(result.orderStatus),
          },
          {
            label: "결제 상태",
            value: paymentStatusLabel(result.paymentStatus),
          },
          {
            label: "결제수단",
            value: paymentMethodLabel(result.paymentMethod),
          },
          {
            label: "받는 분",
            value: result.recipientName ?? "확인 중",
          },
          ...(result.isGift
            ? [
                {
                  label: "선물 배송정보",
                  value: `${giftAddressStatusLabel(result.giftAddressStatus)}${
                    result.giftAddressExpiresAt
                      ? ` · ${formatDate(result.giftAddressExpiresAt)}까지`
                      : ""
                  }`,
                },
              ]
            : []),
        ]}
      />
      <p className="order-lookup-privacy-note">
        개인정보 보호를 위해 주문 조회 화면에는 일부 주문자·수령인 정보만
        표시됩니다.
      </p>

      {result.isGift && result.giftAddressStatus === "pending" ? (
        <form action={resendGiftAddress} className="order-resend-form">
          <strong>선물 배송지 입력 링크 재발송</strong>
          <p>
            수령인 연락처 끝 4자리를 확인한 뒤 기존 링크를 다시 보냅니다.
            입력 기한은 상태 영역에 표시된 기한을 따릅니다.
          </p>
          <label>
            <span>수령인 연락처 끝 4자리</span>
            <input
              inputMode="numeric"
              maxLength={4}
              name="recipientPhoneLast4"
              pattern="[0-9]{4}"
              required
            />
          </label>
          <SiteActionButton
            disabled={giftResendState.kind === "submitting"}
            type="submit"
            variant="quiet"
          >
            {giftResendState.kind === "submitting" ? "재발송 중" : "재발송"}
          </SiteActionButton>
          <CommerceFormStatusMessage status={toFormStatus(giftResendState)} />
        </form>
      ) : null}

      {result.paymentMethod === "portone_virtual_account" ? (
        <div className="order-lookup-bank">
          <strong>가상계좌 입금 안내</strong>
          <CommerceSummaryList
            items={[
              {
                label: "입금 계좌",
                value: result.depositAccount
                  ? `${result.depositAccount.bankName} ${result.depositAccount.accountNumber} / ${result.depositAccount.accountHolder}`
                  : "확인 중",
              },
              {
                label: "입금 기한",
                value: formatDate(result.depositDueAt),
              },
              {
                label: "입금 확인",
                value: formatDate(result.depositConfirmedAt),
              },
              {
                label: "현금영수증",
                value: cashReceiptStatusLabel(result.cashReceiptStatus),
              },
            ]}
          />
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

      <div className="order-lookup-action-panel">
        <SiteActionButton
          onClick={() => setIsReturnRequestOpen((open) => !open)}
          variant="quiet"
        >
          교환·반품 문의하기
        </SiteActionButton>
        {isReturnRequestOpen ? (
          <form action={submitReturnRequest} className="order-return-request-form">
            <strong>교환·반품 문의 접수</strong>
            <p>
              상품 수령 후 7일 이내 교환·반품을 요청할 수 있습니다. 단순 변심으로
              인한 전체 반품 시 왕복 배송비 6,000원이 환불금에서 차감됩니다.
            </p>
            {result.containsLivePlant ? (
              <p>
                생화·식물 포함 상품은 시간 경과, 수령 지연, 개봉 후 관리 상태에
                따라 교환·반품이 제한될 수 있습니다.
              </p>
            ) : null}
            <label>
              <span>문의 유형</span>
              <select name="requestType" required defaultValue="return">
                <option value="exchange">교환 문의</option>
                <option value="return">반품 문의</option>
                <option value="refund">환불 문의</option>
                <option value="damage">파손·하자 문의</option>
                <option value="other">기타 문의</option>
              </select>
            </label>
            <label>
              <span>이름</span>
              <input name="customerName" required maxLength={40} />
            </label>
            <label>
              <span>연락처 또는 이메일</span>
              <input name="customerContact" required maxLength={120} />
            </label>
            <label>
              <span>사유</span>
              <input name="reason" required maxLength={80} />
            </label>
            <CommerceFormField scope="order-refund" wide>
              <span>상세 내용</span>
              <textarea
                maxLength={1200}
                minLength={5}
                name="detail"
                required
              />
            </CommerceFormField>
            <CommerceFormField scope="order-refund" wide>
              <span>사진</span>
              <input
                accept="image/jpeg,image/png,image/webp"
                multiple
                name="photos"
                type="file"
              />
            </CommerceFormField>
            <p>
              고객이 직접 선불 발송하는 경우 최초 배송 시와 같은 수준의 완충 포장을
              해주세요. 부적절한 포장 또는 임의 발송 과정에서 발생한 파손은 고객
              책임으로 처리될 수 있습니다.
            </p>
            <SiteActionButton
              disabled={returnRequestState.kind === "submitting"}
              type="submit"
            >
              {returnRequestState.kind === "submitting" ? "접수 중" : "문의 접수"}
            </SiteActionButton>
            <CommerceFormStatusMessage
              status={toFormStatus(returnRequestState)}
            />
          </form>
        ) : null}
      </div>

      {requiresRefundAccountFallback(result.paymentMethod) ? (
        <form action={submitRefundAccount} className="order-refund-form">
          <div className="order-refund-form-head">
            <strong>환불계좌 등록</strong>
            <SiteActionButton
              disabled={isRefundAccountActive}
              onClick={() => setIsRefundAccountActive(true)}
              variant="quiet"
            >
              환불계좌 등록
            </SiteActionButton>
          </div>
          <fieldset
            className="order-refund-fieldset"
            disabled={!isRefundAccountActive || refundState.kind === "submitting"}
          >
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
            <CommerceFormField scope="order-refund" wide>
              <span>환불 사유</span>
              <textarea maxLength={300} name="refundReason" />
            </CommerceFormField>
            <p>
              환불계좌는 주문자 또는 결제자 명의 계좌를 원칙으로 합니다. 다른
              명의 계좌는 운영자 추가 확인 후 처리될 수 있습니다. 현재 상태:{" "}
              {refundAccountStatusLabel(result.refundAccountStatus)}
            </p>
            <SiteActionButton type="submit">
              {refundState.kind === "submitting" ? "접수 중" : "환불계좌 접수"}
            </SiteActionButton>
          </fieldset>
          <CommerceFormStatusMessage status={toFormStatus(refundState)} />
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

function toFormStatus(state: RefundState): CommerceFormStatus {
  return state.kind === "success" || state.kind === "error"
    ? { kind: state.kind, message: state.message }
    : null;
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
    naver_pay: "N pay",
    portone_card: "카드·간편결제",
    portone_transfer: "실시간 계좌이체",
    portone_virtual_account: "무통장입금(가상계좌)",
  }[status];
}

function requiresRefundAccountFallback(
  status: OrderLookupResult["paymentMethod"],
) {
  return status === "portone_transfer" || status === "portone_virtual_account";
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

function giftAddressStatusLabel(status: OrderLookupResult["giftAddressStatus"]) {
  return {
    canceled: "취소",
    expired: "입력기한 만료",
    not_applicable: "해당 없음",
    pending: "입력 대기",
    submitted: "입력 완료",
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
