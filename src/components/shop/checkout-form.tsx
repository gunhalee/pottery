"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import type {
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
      status: "created" | "payment";
    }
  | {
      error: null;
      order: PortOnePaymentCompleteResult;
      status: "virtual_account";
    }
  | {
      error: null;
      order: PortOnePaymentCompleteResult;
      status: "success";
    };

export function CheckoutForm({
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
    useState<PaymentMethod>("portone_card");
  const [cashReceiptType, setCashReceiptType] =
    useState<CashReceiptType>("none");
  const [cashReceiptIdentifierType, setCashReceiptIdentifierType] =
    useState<CashReceiptIdentifierType>("phone");
  const [giftAddressMode, setGiftAddressMode] = useState<
    "recipient" | "sender"
  >("recipient");
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
  const isVirtualAccount =
    selectedPaymentMethod === "portone_virtual_account";
  const isAccountTransfer = selectedPaymentMethod === "portone_transfer";
  const isCashReceiptPayment = isVirtualAccount || isAccountTransfer;
  const submitLabel = isVirtualAccount
    ? "가상계좌 발급하기"
    : isAccountTransfer
      ? "계좌이체 결제하기"
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
  const shippingPeriodNotice = getShippingPeriodNotice({
    isMadeToOrder,
    madeToOrderDaysMax,
    madeToOrderDaysMin,
    shippingMethod,
  });

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
        notifyByEmail: Boolean(formData.get("notifyByEmail")),
        notifyByKakao: Boolean(formData.get("notifyByKakao")),
        ordererEmail: String(formData.get("ordererEmail") ?? ""),
        ordererName: String(formData.get("ordererName") ?? ""),
        ordererPhone: String(formData.get("ordererPhone") ?? ""),
        paymentMethod: selectedPaymentMethod,
        privacyAgreed: Boolean(formData.get("privacyAgreed")),
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
        termsAgreed: Boolean(formData.get("termsAgreed")),
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
        setState({
          error: null,
          order,
          status: "created",
        });
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

      if (
        completed.paymentStatus === "pending" &&
        completed.paymentMethod === "portone_virtual_account"
      ) {
        setState({
          error: null,
          order: completed,
          status: "virtual_account",
        });
        return;
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
        <span>주문 완료</span>
        <strong>{state.order.orderNumber}</strong>
        <p>
          결제가 완료되어 주문이 접수되었습니다. 주문 및 배송 안내는 이메일과
          카카오 알림톡으로 발송됩니다.
        </p>
        <Link className="button-primary" href="/order/lookup" prefetch={false}>
          주문 조회하기
        </Link>
      </div>
    );
  }

  if (state.status === "virtual_account") {
    const account = state.order.depositAccount;

    return (
      <div className="checkout-result checkout-bank-result">
        <span>가상계좌 입금대기</span>
        <strong>{state.order.orderNumber}</strong>
        <p>
          PortOne을 통해 전용 입금계좌가 발급되었습니다. 입금기한 내 결제가
          확인되면 주문이 확정되고 배송 준비가 시작됩니다.
        </p>
        <dl>
          <div>
            <dt>입금 계좌</dt>
            <dd>
              {account
                ? `${account.bankName} ${account.accountNumber} / ${account.accountHolder}`
                : "주문 조회에서 확인해 주세요"}
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
        <p>{shippingPeriodNotice}</p>
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
                  checked={paymentMethod === "portone_card"}
                  name="paymentMethod"
                  onChange={() => setPaymentMethod("portone_card")}
                  type="radio"
                  value="portone_card"
                />
                <span>카드·간편결제</span>
              </label>
              <label>
                <input
                  checked={paymentMethod === "portone_transfer"}
                  name="paymentMethod"
                  onChange={() => setPaymentMethod("portone_transfer")}
                  type="radio"
                  value="portone_transfer"
                />
                <span>계좌이체</span>
              </label>
              <label>
                <input
                  checked={paymentMethod === "portone_virtual_account"}
                  name="paymentMethod"
                  onChange={() => setPaymentMethod("portone_virtual_account")}
                  type="radio"
                  value="portone_virtual_account"
                />
                <span>무통장입금(가상계좌)</span>
              </label>
            </div>
            {isVirtualAccount ? (
              <p className="checkout-note">
                PortOne 결제창에서 주문별 전용 입금계좌가 발급됩니다. 입금
                확인은 PG사를 통해 자동 반영되며, 발급 후 24시간 내 미입금 시
                주문이 자동 취소될 수 있습니다.
              </p>
            ) : null}
            {isAccountTransfer ? (
              <p className="checkout-note">
                계좌이체는 PortOne 결제창에서 즉시 결제와 현금영수증 신청이
                함께 진행됩니다.
              </p>
            ) : null}
          </fieldset>
        ) : null}

        {isCashReceiptPayment ? (
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
            <p className="checkout-note">
              입력한 발급 정보는 PortOne 결제 요청에 전달되며, 발급 상태는
              결제대행사 처리 결과를 기준으로 반영됩니다.
            </p>
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
            <p className="checkout-note">
              선물하기 주문은 결제 후 수령인이 배송 정보를 입력하는 방식으로
              진행됩니다. 수령인이 결제 완료일 다음 날부터 7일 이내 배송 정보를
              입력하지 않으면 주문이 취소될 수 있고, 환불은 결제자인 주문자에게
              진행됩니다.
            </p>
            {isVirtualAccount ? (
              <p className="checkout-note">
                무통장입금(가상계좌) 주문은 입금 확인 후 수령인에게 배송 정보
                입력 안내가 발송됩니다.
              </p>
            ) : null}
            <div className="checkout-choice-row">
              <label>
                <input
                  checked={giftAddressMode === "recipient"}
                  name="giftAddressMode"
                  onChange={() => setGiftAddressMode("recipient")}
                  type="radio"
                  value="recipient"
                />
                <span>수령인이 배송지 입력</span>
              </label>
              <label>
                <input
                  checked={giftAddressMode === "sender"}
                  name="giftAddressMode"
                  onChange={() => setGiftAddressMode("sender")}
                  type="radio"
                  value="sender"
                />
                <span>주문자가 배송지 입력</span>
              </label>
            </div>
            <label>
              <span>수령인 이름</span>
              <input name="recipientName" required />
            </label>
            <label>
              <span>수령인 연락처</span>
              <input inputMode="tel" name="recipientPhone" required />
            </label>
            {giftAddressMode === "sender" ? (
              <>
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
              </>
            ) : null}
            <label className="checkout-field-wide">
              <span>선물 메모</span>
              <textarea maxLength={200} name="giftMessage" />
            </label>
            <p className="checkout-note">
              식물 포함 상품은 수령인 배송정보 입력 기한이 24시간으로 적용됩니다.
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
            방문수령 장소는 경기도 광주시 수레실길 25-10 1층입니다.
            방문수령은 결제 완료 후 15일 이내 수령을 원칙으로 합니다.
          </p>
        ) : null}

        {isNaverPay ? (
          <p className="checkout-note">
            N pay 버튼으로 들어온 주문은 PortOne 결제 요청 후 간편결제
            방식으로 진행됩니다.
          </p>
        ) : null}

        {containsLivePlant ? (
          <fieldset>
            <legend>생화·식물 포함 상품</legend>
            <p className="checkout-note">
              식물은 생물 특성상 계절, 생육 상태, 배송 환경, 수령 지연, 관리
              상태에 따라 상태가 달라질 수 있습니다.
            </p>
            <p className="checkout-note">
              수령 후 가능한 빠르게 개봉하고 상품별 안내에 따라 통풍, 물주기,
              햇빛 조건을 확인해 주세요. 수령 지연·개봉 후 관리 부주의·생육
              변화에 따른 교환·반품은 제한될 수 있습니다.
            </p>
          </fieldset>
        ) : null}

        <fieldset>
          <legend>필수 확인</legend>
          <label className="checkout-checkbox">
            <input name="termsAgreed" required type="checkbox" />
            <span>
              <Link href="/terms" prefetch={false} target="_blank">
                이용약관
              </Link>
              에 동의합니다.
            </span>
          </label>
          <label className="checkout-checkbox">
            <input name="privacyAgreed" required type="checkbox" />
            <span>
              <Link href="/privacy" prefetch={false} target="_blank">
                개인정보 수집 및 이용
              </Link>
              에 동의합니다.
            </span>
          </label>
        </fieldset>

        <fieldset>
          <legend>알림 옵션</legend>
          <label className="checkout-checkbox">
            <input defaultChecked name="notifyByKakao" type="checkbox" />
            <span>카카오 알림톡으로 받기</span>
          </label>
          <label className="checkout-checkbox">
            <input defaultChecked name="notifyByEmail" type="checkbox" />
            <span>이메일로 받기</span>
          </label>
        </fieldset>

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

function getShippingPeriodNotice({
  isMadeToOrder,
  madeToOrderDaysMax,
  madeToOrderDaysMin,
  shippingMethod,
}: {
  isMadeToOrder: boolean;
  madeToOrderDaysMax: number | null;
  madeToOrderDaysMin: number | null;
  shippingMethod: ShippingMethod;
}) {
  if (shippingMethod === "pickup") {
    return "방문수령은 결제 완료 후 15일 이내 수령을 원칙으로 합니다.";
  }

  if (isMadeToOrder) {
    return `제작 상품은 결제 또는 입금 확인 후 ${madeToOrderDaysMin ?? 30}~${madeToOrderDaysMax ?? 45}일의 제작 기간이 필요하며, 제작 완료 후 발송됩니다.`;
  }

  return "결제 또는 입금 확인 후 2~5영업일 이내 발송을 원칙으로 합니다.";
}

function productOptionLabel(option: ProductOption) {
  return option === "plant_included" ? "식물 포함" : "식물 제외";
}
