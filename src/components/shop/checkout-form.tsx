"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import type {
  BankTransferAccount,
  CashReceiptIdentifierType,
  CashReceiptType,
  CheckoutMode,
  OrderDraftResult,
  PaymentMethod,
  ProductOption,
  ShippingMethod,
} from "@/lib/orders/order-model";
import type {
  PortOnePaymentCompleteResult,
  PortOnePaymentPrepareResult,
} from "@/lib/payments/portone-model";

type CheckoutFormProps = {
  bankTransferAccount: BankTransferAccount;
  checkoutMode: CheckoutMode;
  containsLivePlant: boolean;
  isMadeToOrder: boolean;
  madeToOrderDaysMax: number | null;
  madeToOrderDaysMin: number | null;
  madeToOrderNotice?: string;
  productOption: ProductOption;
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
      status: "created" | "payment" | "bank_transfer";
    }
  | {
      error: null;
      order: PortOnePaymentCompleteResult;
      status: "success";
    };

export function CheckoutForm({
  bankTransferAccount,
  checkoutMode,
  containsLivePlant,
  isMadeToOrder,
  madeToOrderDaysMax,
  madeToOrderDaysMin,
  madeToOrderNotice,
  productOption,
  productSlug,
  productTitle,
  quantity,
  shippingFee,
  shippingMethod,
  subtotal,
  total,
  unitPrice,
}: CheckoutFormProps) {
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("portone");
  const [cashReceiptType, setCashReceiptType] =
    useState<CashReceiptType>("none");
  const [cashReceiptIdentifierType, setCashReceiptIdentifierType] =
    useState<CashReceiptIdentifierType>("phone");
  const [state, setState] = useState<SubmitState>({
    error: null,
    order: null,
    status: "idle",
  });

  const isGift = checkoutMode === "gift";
  const isNaverPay = checkoutMode === "naver_pay";
  const isParcel = shippingMethod === "parcel";
  const selectedPaymentMethod: PaymentMethod = isNaverPay
    ? "naver_pay"
    : paymentMethod;
  const isBankTransfer = selectedPaymentMethod === "bank_transfer";
  const submitLabel = isBankTransfer
    ? "입금대기 주문 접수"
    : isNaverPay
      ? "N pay 결제하기"
      : "결제하기";
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
        cashReceiptIdentifier: String(
          formData.get("cashReceiptIdentifier") ?? "",
        ),
        cashReceiptIdentifierType,
        cashReceiptType,
        checkoutMode,
        giftMessage: String(formData.get("giftMessage") ?? ""),
        lookupPassword: String(formData.get("lookupPassword") ?? ""),
        madeToOrder: isMadeToOrder,
        madeToOrderAcknowledged: Boolean(
          formData.get("madeToOrderAcknowledged"),
        ),
        ordererEmail: String(formData.get("ordererEmail") ?? ""),
        ordererName: String(formData.get("ordererName") ?? ""),
        ordererPhone: String(formData.get("ordererPhone") ?? ""),
        paymentMethod: selectedPaymentMethod,
        productOption,
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

    if (result.order.paymentMethod === "bank_transfer") {
      setState({
        error: null,
        order: result.order,
        status: "bank_transfer",
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

  if (state.status === "bank_transfer") {
    const account = state.order.bankTransferAccount ?? bankTransferAccount;

    return (
      <div className="checkout-result checkout-bank-result">
        <span>입금대기 주문</span>
        <strong>{state.order.orderNumber}</strong>
        <p>
          입금 확인 후 주문이 확정됩니다. 입금자명은 주문자명과 동일하게
          보내 주세요.
        </p>
        <dl>
          <div>
            <dt>입금 계좌</dt>
            <dd>
              {account.bankName} {account.accountNumber} /{" "}
              {account.accountHolder}
            </dd>
          </div>
          <div>
            <dt>입금 금액</dt>
            <dd>{formatCurrency(state.order.total)}</dd>
          </div>
          <div>
            <dt>입금 기한</dt>
            <dd>{formatDate(state.order.depositDueAt)}</dd>
          </div>
        </dl>
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
            : "주문 기록은 생성되었습니다. 결제 설정을 확인한 뒤 다시 결제할 수 있습니다."}
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
              {formatCurrency(unitPrice)} x {quantity}
            </dd>
          </div>
          <div>
            <dt>상품 옵션</dt>
            <dd>{productOptionLabel(productOption)}</dd>
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
        {containsLivePlant ? (
          <p>
            식물 포함 상품은 제주 및 도서산간 택배 발송이 제한되며,
            혹한기·혹서기에는 운영 안내에 따라 출고 일정이 조정될 수
            있습니다.
          </p>
        ) : null}
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

        {!isNaverPay ? (
          <fieldset>
            <legend>결제수단</legend>
            <div className="checkout-choice-row">
              <label>
                <input
                  checked={paymentMethod === "portone"}
                  name="paymentMethod"
                  onChange={() => setPaymentMethod("portone")}
                  type="radio"
                  value="portone"
                />
                <span>카드·간편결제</span>
              </label>
              <label>
                <input
                  checked={paymentMethod === "bank_transfer"}
                  name="paymentMethod"
                  onChange={() => setPaymentMethod("bank_transfer")}
                  type="radio"
                  value="bank_transfer"
                />
                <span>무통장입금</span>
              </label>
            </div>
            {isBankTransfer ? (
              <p className="checkout-note">
                무통장입금은 주문 완료 후 24시간 내 입금이 확인되어야 주문이
                확정됩니다.
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {isBankTransfer ? (
          <fieldset>
            <legend>현금영수증</legend>
            <div className="checkout-choice-row">
              <label>
                <input
                  checked={cashReceiptType === "none"}
                  name="cashReceiptType"
                  onChange={() => setCashReceiptType("none")}
                  type="radio"
                  value="none"
                />
                <span>신청 안 함</span>
              </label>
              <label>
                <input
                  checked={cashReceiptType === "personal"}
                  name="cashReceiptType"
                  onChange={() => {
                    setCashReceiptType("personal");
                    setCashReceiptIdentifierType("phone");
                  }}
                  type="radio"
                  value="personal"
                />
                <span>개인 소득공제용</span>
              </label>
              <label>
                <input
                  checked={cashReceiptType === "business"}
                  name="cashReceiptType"
                  onChange={() => {
                    setCashReceiptType("business");
                    setCashReceiptIdentifierType("business_registration");
                  }}
                  type="radio"
                  value="business"
                />
                <span>사업자 지출증빙용</span>
              </label>
            </div>
            {cashReceiptType !== "none" ? (
              <>
                {cashReceiptType === "personal" ? (
                  <label>
                    <span>발급수단</span>
                    <select
                      onChange={(event) =>
                        setCashReceiptIdentifierType(
                          event.target.value as CashReceiptIdentifierType,
                        )
                      }
                      value={cashReceiptIdentifierType}
                    >
                      <option value="phone">휴대전화번호</option>
                      <option value="cash_receipt_card">
                        현금영수증 카드번호
                      </option>
                    </select>
                  </label>
                ) : null}
                <label>
                  <span>
                    {cashReceiptType === "business"
                      ? "사업자등록번호"
                      : cashReceiptIdentifierType === "cash_receipt_card"
                        ? "카드번호"
                        : "휴대전화번호"}
                  </span>
                  <input
                    inputMode="numeric"
                    name="cashReceiptIdentifier"
                    required
                  />
                </label>
              </>
            ) : null}
          </fieldset>
        ) : null}

        {isMadeToOrder ? (
          <fieldset>
            <legend>추가 제작 주문</legend>
            <p className="checkout-note">
              추가 제작은 결제 또는 입금 확인일 기준 약{" "}
              {madeToOrderDaysMin ?? 30}~{madeToOrderDaysMax ?? 45}일이
              소요될 수 있으며, 제작 착수 후 취소 시 실제 발생 비용이 차감될
              수 있습니다.
            </p>
            {madeToOrderNotice ? (
              <p className="checkout-note">{madeToOrderNotice}</p>
            ) : null}
            <label className="checkout-checkbox">
              <input name="madeToOrderAcknowledged" required type="checkbox" />
              <span>추가 제작 기간과 취소 기준을 확인했습니다.</span>
            </label>
          </fieldset>
        ) : null}

        {isGift ? (
          <fieldset>
            <legend>선물하기</legend>
            <label className="checkout-field-wide">
              <span>선물 메모</span>
              <textarea maxLength={200} name="giftMessage" />
            </label>
            <p className="checkout-note">
              식물 포함 상품은 수령인 배송정보 입력 기한이 24시간으로 적용될
              수 있습니다.
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
            N pay 버튼으로 들어온 주문은 PortOne 결제 요청 후 간편결제
            방식으로 진행됩니다.
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

function formatDate(value: string | null | undefined) {
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

function productOptionLabel(option: ProductOption) {
  return option === "plant_included" ? "식물 포함" : "식물 제외";
}
