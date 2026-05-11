"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import type {
  CheckoutMode,
  OrderDraftResult,
  ShippingMethod,
} from "@/lib/orders/order-model";
import type {
  PortOnePaymentCompleteResult,
  PortOnePaymentPrepareResult,
} from "@/lib/payments/portone-model";

type CheckoutFormProps = {
  checkoutMode: CheckoutMode;
  productSlug: string;
  productTitle: string;
  quantity: number;
  shippingFee: number;
  shippingMethod: ShippingMethod;
  subtotal: number;
  total: number;
  unitPrice: number;
};

type SubmitState =
  | {
      error: string | null;
      order: null;
      status: "idle" | "submitting";
    }
  | {
      error: string | null;
      order: OrderDraftResult;
      status: "created" | "payment";
    }
  | {
      error: null;
      order: PortOnePaymentCompleteResult;
      status: "success";
    };

export function CheckoutForm({
  checkoutMode,
  productSlug,
  productTitle,
  quantity,
  shippingFee,
  shippingMethod,
  subtotal,
  total,
  unitPrice,
}: CheckoutFormProps) {
  const [state, setState] = useState<SubmitState>({
    error: null,
    order: null,
    status: "idle",
  });

  const isGift = checkoutMode === "gift";
  const isNaverPay = checkoutMode === "naver_pay";
  const isParcel = shippingMethod === "parcel";
  const submitLabel = isNaverPay ? "N pay 결제하기" : "결제하기";
  const modeLabel = useMemo(() => {
    if (isGift) {
      return "선물하기";
    }

    if (isNaverPay) {
      return "N pay";
    }

    return "일반 구매";
  }, [isGift, isNaverPay]);

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (state.status === "submitting") {
      return;
    }

    const formData = new FormData(event.currentTarget);

    setState({
      error: null,
      order: null,
      status: "submitting",
    });

    const response = await fetch("/api/orders/draft", {
      body: JSON.stringify({
        checkoutMode,
        giftMessage: String(formData.get("giftMessage") ?? ""),
        lookupPassword: String(formData.get("lookupPassword") ?? ""),
        ordererEmail: String(formData.get("ordererEmail") ?? ""),
        ordererName: String(formData.get("ordererName") ?? ""),
        ordererPhone: String(formData.get("ordererPhone") ?? ""),
        productSlug,
        quantity,
        recipientName: String(formData.get("recipientName") ?? ""),
        recipientPhone: String(formData.get("recipientPhone") ?? ""),
        shippingAddress1: String(formData.get("shippingAddress1") ?? ""),
        shippingAddress2: String(formData.get("shippingAddress2") ?? ""),
        shippingMemo: String(formData.get("shippingMemo") ?? ""),
        shippingMethod,
        shippingPostcode: String(formData.get("shippingPostcode") ?? ""),
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      order?: OrderDraftResult;
    };

    if (!response.ok || !result.order) {
      setState({
        error: result.error ?? "주문 접수 중 오류가 발생했습니다.",
        order: null,
        status: "idle",
      });
      return;
    }

    await requestPayment(result.order);
  }

  async function requestPayment(order: OrderDraftResult) {
    setState({
      error: null,
      order,
      status: "payment",
    });

    try {
      const prepareResponse = await fetch("/api/payments/portone/prepare", {
        body: JSON.stringify({
          orderId: order.orderId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const prepared = (await prepareResponse.json().catch(() => ({}))) as
        | (PortOnePaymentPrepareResult & { error?: never })
        | { error?: string };

      if (!prepareResponse.ok || !("paymentRequest" in prepared)) {
        throw new Error(
          prepared.error ?? "PortOne 결제 준비 중 오류가 발생했습니다.",
        );
      }

      const PortOne = await import("@portone/browser-sdk/v2");
      const paymentResponse = await PortOne.requestPayment(
        prepared.paymentRequest as unknown as Parameters<
          typeof PortOne.requestPayment
        >[0],
      );

      if (!paymentResponse) {
        return;
      }

      if (paymentResponse.code !== undefined) {
        throw new Error(paymentResponse.message ?? "결제가 취소되었습니다.");
      }

      const completeResponse = await fetch("/api/payments/portone/complete", {
        body: JSON.stringify({
          orderId: order.orderId,
          paymentId: paymentResponse.paymentId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const completed = (await completeResponse.json().catch(() => ({}))) as
        | (PortOnePaymentCompleteResult & { error?: never })
        | { error?: string };

      if (!completeResponse.ok || !("orderNumber" in completed)) {
        throw new Error(
          completed.error ?? "결제 검증 중 오류가 발생했습니다.",
        );
      }

      setState({
        error: null,
        order: completed,
        status: "success",
      });
    } catch (error) {
      setState({
        error:
          error instanceof Error
            ? error.message
            : "결제 진행 중 오류가 발생했습니다.",
        order,
        status: "created",
      });
    }
  }

  if (state.status === "success") {
    return (
      <div className="checkout-result">
        <span>주문 접수</span>
        <strong>{state.order.orderNumber}</strong>
        <p>
          결제 검증이 완료되었습니다. 주문 조회에서 결제와 배송 진행 상태를
          확인할 수 있습니다.
        </p>
        <Link className="button-primary" href="/order/lookup" prefetch={false}>
          주문 조회하기
        </Link>
      </div>
    );
  }

  if (state.status === "created" || state.status === "payment") {
    return (
      <div className="checkout-result">
        <span>{state.status === "payment" ? "결제 진행" : "주문 접수"}</span>
        <strong>{state.order.orderNumber}</strong>
        <p>
          {state.status === "payment"
            ? "PortOne 결제창을 준비하고 있습니다."
            : "주문 기록은 생성되었습니다. 결제 설정을 확인한 뒤 이어서 결제할 수 있습니다."}
        </p>
        {state.error ? <p className="checkout-error">{state.error}</p> : null}
        <button
          className="button-primary"
          disabled={state.status === "payment"}
          onClick={() => requestPayment(state.order)}
          type="button"
        >
          {state.status === "payment" ? "결제 준비 중" : "결제 다시 시도"}
        </button>
        <Link className="button-quiet" href="/order/lookup" prefetch={false}>
          주문 조회하기
        </Link>
      </div>
    );
  }

  return (
    <div className="checkout-layout">
      <section className="checkout-summary" aria-label="주문 상품">
        <div className="checkout-summary-head">
          <span>{modeLabel}</span>
          <strong>{productTitle}</strong>
        </div>
        <dl className="checkout-summary-list">
          <div>
            <dt>상품 금액</dt>
            <dd>
              {formatCurrency(unitPrice)} × {quantity}
            </dd>
          </div>
          <div>
            <dt>배송 방법</dt>
            <dd>{shippingMethod === "pickup" ? "방문수령" : "택배"}</dd>
          </div>
          <div>
            <dt>배송비</dt>
            <dd>{formatCurrency(shippingFee)}</dd>
          </div>
          <div>
            <dt>합계</dt>
            <dd>{formatCurrency(total)}</dd>
          </div>
        </dl>
        <p>
          상품 {formatCurrency(subtotal)} · 배송비 {formatCurrency(shippingFee)}
        </p>
      </section>

      <form className="checkout-form" onSubmit={submitOrder}>
        <fieldset>
          <legend>주문자 정보</legend>
          <label>
            <span>이름</span>
            <input name="ordererName" required />
          </label>
          <label>
            <span>연락처</span>
            <input
              inputMode="tel"
              name="ordererPhone"
              placeholder="01012345678"
              required
            />
          </label>
          <label>
            <span>이메일</span>
            <input name="ordererEmail" required type="email" />
          </label>
          <label>
            <span>조회 비밀번호</span>
            <input
              inputMode="numeric"
              maxLength={4}
              minLength={4}
              name="lookupPassword"
              pattern="[0-9]{4}"
              placeholder="숫자 4자리"
              required
            />
          </label>
        </fieldset>

        {isGift ? (
          <fieldset>
            <legend>선물하기</legend>
            <label className="checkout-field-wide">
              <span>선물 메모</span>
              <textarea maxLength={200} name="giftMessage" />
            </label>
            <p className="checkout-note">
              수령인 배송지 입력 링크와 알림톡 발송은 정식 결제 연결 단계에서
              이어 붙입니다. 지금은 선물 주문 여부와 메모를 주문 기록에
              저장합니다.
            </p>
          </fieldset>
        ) : null}

        {!isGift && isParcel ? (
          <fieldset>
            <legend>배송지</legend>
            <label>
              <span>수령인</span>
              <input name="recipientName" required />
            </label>
            <label>
              <span>수령인 연락처</span>
              <input inputMode="tel" name="recipientPhone" required />
            </label>
            <label>
              <span>우편번호</span>
              <input name="shippingPostcode" required />
            </label>
            <label className="checkout-field-wide">
              <span>주소</span>
              <input name="shippingAddress1" required />
            </label>
            <label className="checkout-field-wide">
              <span>상세 주소</span>
              <input name="shippingAddress2" />
            </label>
            <label className="checkout-field-wide">
              <span>배송 메모</span>
              <input name="shippingMemo" />
            </label>
          </fieldset>
        ) : null}

        {!isGift && !isParcel ? (
          <p className="checkout-note">
            방문수령 일정은 주문 접수 후 카카오채널로 조율합니다.
          </p>
        ) : null}

        {isNaverPay ? (
          <p className="checkout-note">
            N pay 버튼으로 들어온 주문은 PortOne 결제 요청 시 간편결제 방식으로
            전달됩니다. 실제 노출 결제수단은 PortOne 채널 설정을 따릅니다.
          </p>
        ) : null}

        <div className="checkout-actions">
          <button
            className="button-primary"
            disabled={state.status === "submitting"}
            type="submit"
          >
            {state.status === "submitting" ? "접수 중" : submitLabel}
          </button>
          {state.error ? <p className="checkout-error">{state.error}</p> : null}
        </div>
      </form>
    </div>
  );
}

function formatCurrency(value: number) {
  return `${new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 0,
  }).format(value)}원`;
}
