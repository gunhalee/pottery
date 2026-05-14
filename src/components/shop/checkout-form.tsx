"use client";

import type { FormEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { SiteLink } from "@/components/navigation/site-link";
import {
  SiteActionButton,
  SiteActionLink,
} from "@/components/site/actions";
import {
  CommerceFormActions,
  CommerceFormCheckbox,
  CommerceFormField,
  CommerceFormNote,
  CommerceFormStatusMessage,
  CommerceSummaryList,
} from "@/components/site/commerce-form-primitives";
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
      order: RecoverableOrderDraft;
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

type RecoverableOrderDraft = OrderDraftResult & {
  paymentId?: string;
};

type StoredCheckoutRecovery = {
  checkoutAttemptId: string;
  orderId?: string;
  orderNumber?: string;
  paymentId?: string;
  recoveryToken?: string;
  recoveryTokenExpiresAt?: string | null;
  signature: string;
  updatedAt: number;
};

type CheckoutRecoveryResponse = {
  action:
    | "manual_review"
    | "none"
    | "prepare_payment"
    | "retry_payment"
    | "submit_order"
    | "sync_payment";
  code: string;
  message: string;
  order?: {
    depositAccount?: PortOnePaymentCompleteResult["depositAccount"];
    depositDueAt?: string | null;
    orderId: string;
    orderNumber: string;
    paymentMethod?: PaymentMethod;
    paymentStatus: PortOnePaymentCompleteResult["paymentStatus"];
    total: number;
  };
  payment?: {
    paymentId?: string;
  } | null;
  retryable: boolean;
};

const checkoutRecoveryStorageKey = "pottery.checkout.recovery";
const checkoutRecoveryRequestTimeoutMs = 8000;

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
  const recoveryRequestsRef = useRef(
    new Map<string, Promise<CheckoutRecoveryResponse | null>>(),
  );

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
  const checkoutSignature = useMemo(
    () =>
      createCheckoutSignature({
        checkoutMode,
        isMadeToOrder,
        paymentMethod: selectedPaymentMethod,
        productOption,
        productSlug,
        quantity,
        shippingMethod,
      }),
    [
      checkoutMode,
      isMadeToOrder,
      productOption,
      productSlug,
      quantity,
      selectedPaymentMethod,
      shippingMethod,
    ],
  );

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (state.status === "submitting") {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const checkoutRecovery = getOrCreateCheckoutRecovery(checkoutSignature);

    setState({
      error: null,
      order: null,
      status: "submitting",
    });

    let response: Response;

    try {
      response = await fetch("/api/orders/draft", {
      body: JSON.stringify({
        cashReceiptIdentifier: String(
          formData.get("cashReceiptIdentifier") ?? "",
        ),
        cashReceiptIdentifierType,
        cashReceiptType,
        checkoutAttemptId: checkoutRecovery.checkoutAttemptId,
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
    } catch (error) {
      setState({
        error:
          error instanceof Error
            ? error.message
            : "주문 접수 중 오류가 발생했습니다.",
        order: null,
        status: "idle",
      });
      return;
    }

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

    const order = mergeCheckoutRecovery(result.order, checkoutRecovery);
    persistCheckoutRecovery(checkoutSignature, order);
    await requestPayment(order);
  }

  async function requestPayment(
    order: RecoverableOrderDraft,
    options: { forceNewPaymentId?: boolean } = {},
  ) {
    setState({
      error: null,
      order,
      status: "payment",
    });

    let latestOrder = order;
    let shouldAutoRecover = false;

    try {
      const prepareResponse = await fetch("/api/payments/portone/prepare", {
        body: JSON.stringify({
          forceNewPaymentId: options.forceNewPaymentId,
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
          prepared.error ?? "결제창 로딩 중 오류가 발생했습니다.",
        );
      }

      const preparedOrder: RecoverableOrderDraft = {
        ...order,
        paymentId: prepared.paymentRequest.paymentId,
      };
      latestOrder = preparedOrder;
      persistCheckoutRecovery(checkoutSignature, preparedOrder);
      setState({
        error: null,
        order: preparedOrder,
        status: "payment",
      });

      const PortOne = await import("@portone/browser-sdk/v2");
      const paymentResponse = await PortOne.requestPayment(
        prepared.paymentRequest as unknown as Parameters<
          typeof PortOne.requestPayment
        >[0],
      );

      if (!paymentResponse) {
        setState({
          error: null,
          order: preparedOrder,
          status: "created",
        });
        return;
      }

      if (paymentResponse.code !== undefined) {
        throw new Error(paymentResponse.message ?? "결제가 취소되었습니다.");
      }

      shouldAutoRecover = true;

      const completeResponse = await fetch("/api/payments/portone/complete", {
        body: JSON.stringify({
          orderId: preparedOrder.orderId,
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
        const recovery = await recoverCheckout(preparedOrder, {
          paymentId: paymentResponse.paymentId,
          sync: true,
        });
        if (recovery && applyCompletedRecovery(recovery)) {
          return;
        }

        throw new Error(
          recovery?.message ??
            completed.error ??
            "결제 검증 중 오류가 발생했습니다.",
        );
      }

      if (!isSuccessfulPaymentCompletion(completed)) {
        throw new Error(getPaymentCompletionError(completed));
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

      clearCheckoutRecovery(checkoutSignature);
      setState({
        error: null,
        order: completed,
        status: "success",
      });
    } catch (error) {
      const recovery = shouldAutoRecover
        ? await recoverCheckout(latestOrder, { sync: true })
        : null;
      if (recovery && applyCompletedRecovery(recovery)) {
        return;
      }

      setState({
        error:
          recovery?.message ??
          (error instanceof Error
            ? error.message
            : "결제 진행 중 오류가 발생했습니다."),
        order: latestOrder,
        status: "created",
      });
    }
  }

  async function handleRetryPayment(order: RecoverableOrderDraft) {
    if (state.status === "payment") {
      return;
    }

    setState({
      error: null,
      order,
      status: "payment",
    });

    const recovery = await recoverCheckout(order, {
      sync: !isRetryablePaymentStatus(order.paymentStatus),
    });
    if (recovery && applyCompletedRecovery(recovery)) {
      return;
    }

    if (recovery?.action === "manual_review") {
      setState({
        error: recovery.message,
        order,
        status: "created",
      });
      return;
    }

    if (!recovery && order.paymentId) {
      setState({
        error: "결제 상태를 확인하는 중 오류가 발생했습니다. 잠시 후 다시 확인해 주세요.",
        order,
        status: "created",
      });
      return;
    }

    await requestPayment(order, {
      forceNewPaymentId:
        recovery?.action === "retry_payment" ||
        isRetryablePaymentStatus(recovery?.order?.paymentStatus ?? order.paymentStatus),
    });
  }

  async function handleRecoverPayment(order: RecoverableOrderDraft) {
    if (state.status === "payment") {
      return;
    }

    setState({
      error: null,
      order,
      status: "payment",
    });

    const recovery = await recoverCheckout(order, { sync: true });
    if (recovery && applyCompletedRecovery(recovery)) {
      return;
    }

    setState({
      error:
        recovery?.message ??
        "결제 상태를 확인하는 중 오류가 발생했습니다. 잠시 후 다시 확인해 주세요.",
      order,
      status: "created",
    });
  }

  async function recoverCheckout(
    order: RecoverableOrderDraft,
    options: { paymentId?: string; sync?: boolean } = {},
  ): Promise<CheckoutRecoveryResponse | null> {
    const stored = readStoredCheckoutRecovery(checkoutSignature);
    const attemptId = order.checkoutAttemptId ?? stored?.checkoutAttemptId;
    const recoveryToken = order.recoveryToken ?? stored?.recoveryToken;
    const paymentId = options.paymentId ?? order.paymentId ?? stored?.paymentId;

    if (!attemptId && !paymentId) {
      return null;
    }

    const recoveryKey = [
      attemptId ?? "no-attempt",
      order.orderId,
      paymentId ?? "no-payment",
      options.sync === false ? "local" : "sync",
    ].join(":");
    const inFlight = recoveryRequestsRef.current.get(recoveryKey);

    if (inFlight) {
      return inFlight;
    }

    const recoveryRequest = (async () => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        checkoutRecoveryRequestTimeoutMs,
      );

      try {
        const response = await fetch("/api/checkout/recover", {
          body: JSON.stringify({
            attemptId,
            orderId: order.orderId,
            paymentId,
            recoveryToken,
            sync: options.sync,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
          signal: controller.signal,
        });
        const recovery = (await response.json().catch(() => null)) as
          | CheckoutRecoveryResponse
          | null;

        if (!recovery || !("action" in recovery)) {
          return null;
        }

        if (recovery.order) {
          persistCheckoutRecovery(checkoutSignature, {
            ...order,
            checkoutAttemptId: attemptId,
            orderId: recovery.order.orderId,
            orderNumber: recovery.order.orderNumber,
            paymentId: recovery.payment?.paymentId ?? paymentId,
            recoveryToken,
            recoveryTokenExpiresAt:
              order.recoveryTokenExpiresAt ?? stored?.recoveryTokenExpiresAt,
          });
        }

        return recovery;
      } catch {
        return null;
      } finally {
        window.clearTimeout(timeoutId);
        recoveryRequestsRef.current.delete(recoveryKey);
      }
    })();

    recoveryRequestsRef.current.set(recoveryKey, recoveryRequest);
    return recoveryRequest;
  }

  function applyCompletedRecovery(recovery: CheckoutRecoveryResponse) {
    if (!recovery.order) {
      return false;
    }

    const completed: PortOnePaymentCompleteResult = {
      depositAccount: recovery.order.depositAccount,
      depositDueAt: recovery.order.depositDueAt,
      orderId: recovery.order.orderId,
      orderNumber: recovery.order.orderNumber,
      paymentId: recovery.payment?.paymentId ?? "",
      paymentMethod: recovery.order.paymentMethod,
      paymentStatus: recovery.order.paymentStatus,
      total: recovery.order.total,
    };

    if (
      completed.paymentStatus === "pending" &&
      completed.paymentMethod === "portone_virtual_account"
    ) {
      setState({
        error: null,
        order: completed,
        status: "virtual_account",
      });
      return true;
    }

    if (completed.paymentStatus === "paid") {
      clearCheckoutRecovery(checkoutSignature);
      setState({
        error: null,
        order: completed,
        status: "success",
      });
      return true;
    }

    return false;
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
        <SiteActionLink href="/order/lookup">
          주문 조회하기
        </SiteActionLink>
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
          전용 입금계좌가 발급되었습니다. 입금기한 내 결제가
          확인되면 주문이 확정되고 배송 준비가 시작됩니다.
        </p>
        <CommerceSummaryList
          items={[
            {
              label: "입금 계좌",
              value: account
                ? `${account.bankName} ${account.accountNumber} / ${account.accountHolder}`
                : "주문 조회에서 확인해 주세요",
            },
            {
              label: "입금 금액",
              value: formatCurrency(state.order.total),
            },
            {
              label: "입금 기한",
              value: formatDate(state.order.depositDueAt),
            },
          ]}
        />
        <SiteActionLink href="/order/lookup">
          주문 조회하기
        </SiteActionLink>
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
            ? "결제창을 로딩하고 있습니다."
            : "주문이 완료되지 않았습니다. 다시 한번 주문해주세요."}
        </p>
        <CommerceFormStatusMessage status={toErrorStatus(state.error)} />
        <SiteActionButton
          disabled={state.status === "payment"}
          onClick={() => handleRetryPayment(state.order)}
        >
          {state.status === "payment" ? "결제 준비 중" : "결제 다시 시도"}
        </SiteActionButton>
        {state.status === "created" ? (
          <SiteActionButton
            onClick={() => handleRecoverPayment(state.order)}
            variant="quiet"
          >
            결제 상태 다시 확인
          </SiteActionButton>
        ) : null}
        <SiteActionLink href="/order/lookup" variant="quiet">
          주문 조회하기
        </SiteActionLink>
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
        <CommerceSummaryList
          className="checkout-summary-list"
          items={[
            {
              label: "상품 금액",
              value: `${formatCurrency(unitPrice)} x ${quantity}`,
            },
            {
              label: "상품 옵션",
              value: productOptionLabel(productOption),
            },
            {
              label: "배송 방법",
              value: shippingMethod === "pickup" ? "방문수령" : "택배",
            },
            {
              label: "배송비",
              value: formatCurrency(shippingFee),
            },
            {
              label: "합계",
              value: formatCurrency(total),
            },
          ]}
        />
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
              autoComplete="off"
              data-1p-ignore="true"
              data-bwignore="true"
              data-lpignore="true"
              inputMode="numeric"
              maxLength={4}
              minLength={4}
              name="lookupPassword"
              pattern="[0-9]{4}"
              placeholder="숫자 4자리"
              required
              type="password"
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
              <CommerceFormNote>
                결제창에서 주문별 전용 입금계좌가 발급됩니다. 입금
                확인은 PG사를 통해 자동 반영되며, 발급 후 24시간 내 미입금 시
                주문이 자동 취소될 수 있습니다.
              </CommerceFormNote>
            ) : null}
            {isAccountTransfer ? (
              <CommerceFormNote>
                계좌이체는 결제창에서 즉시 결제와 현금영수증 신청이
                함께 진행됩니다.
              </CommerceFormNote>
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
            <CommerceFormNote>
              입력한 발급 정보는 결제 요청에 전달되며, 발급 상태는
              결제대행사 처리 결과를 기준으로 반영됩니다.
            </CommerceFormNote>
          </fieldset>
        ) : null}

        {isMadeToOrder ? (
          <fieldset>
            <legend>추가 제작 주문</legend>
            <CommerceFormNote>
              추가 제작은 결제 또는 입금 확인일 기준 약{" "}
              {madeToOrderDaysMin ?? 30}~{madeToOrderDaysMax ?? 45}일이
              소요될 수 있으며, 제작 착수 후 취소 시 실제 발생 비용이 차감될
              수 있습니다.
            </CommerceFormNote>
            {madeToOrderNotice ? (
              <CommerceFormNote>{madeToOrderNotice}</CommerceFormNote>
            ) : null}
            <CommerceFormCheckbox>
              <input name="madeToOrderAcknowledged" required type="checkbox" />
              <span>추가 제작 기간과 취소 기준을 확인했습니다.</span>
            </CommerceFormCheckbox>
          </fieldset>
        ) : null}

        {isGift ? (
          <fieldset>
            <legend>선물하기</legend>
            <CommerceFormNote>
              선물하기 주문은 결제 후 수령인이 배송 정보를 입력하는 방식으로
              진행됩니다. 수령인이 결제 완료일 다음 날부터 7일 이내 배송 정보를
              입력하지 않으면 주문이 취소될 수 있고, 환불은 결제자인 주문자에게
              진행됩니다.
            </CommerceFormNote>
            {isVirtualAccount ? (
              <CommerceFormNote>
                무통장입금(가상계좌) 주문은 입금 확인 후 수령인에게 배송 정보
                입력 안내가 발송됩니다.
              </CommerceFormNote>
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
                <CommerceFormField wide>
                  <span>주소</span>
                  <input name="shippingAddress1" required />
                </CommerceFormField>
                <CommerceFormField wide>
                  <span>상세 주소</span>
                  <input name="shippingAddress2" />
                </CommerceFormField>
                <CommerceFormField wide>
                  <span>배송 메모</span>
                  <input name="shippingMemo" />
                </CommerceFormField>
              </>
            ) : null}
            <CommerceFormField wide>
              <span>선물 메모</span>
              <textarea maxLength={200} name="giftMessage" />
            </CommerceFormField>
            <CommerceFormNote>
              식물 포함 상품은 수령인 배송정보 입력 기한이 24시간으로 적용됩니다.
            </CommerceFormNote>
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
            <CommerceFormField wide>
              <span>주소</span>
              <input name="shippingAddress1" required />
            </CommerceFormField>
            <CommerceFormField wide>
              <span>상세 주소</span>
              <input name="shippingAddress2" />
            </CommerceFormField>
            <CommerceFormField wide>
              <span>배송 메모</span>
              <input name="shippingMemo" />
            </CommerceFormField>
          </fieldset>
        ) : null}

        {!isGift && !isParcel ? (
          <CommerceFormNote>
            방문수령 장소는 경기도 광주시 수레실길 25-10 1층입니다.
            방문수령은 결제 후 15일 이내 수령을 원칙으로 합니다.
          </CommerceFormNote>
        ) : null}

        {isNaverPay ? (
          <CommerceFormNote>
            N pay 버튼으로 들어온 주문은 결제 요청 후 간편결제
            방식으로 진행됩니다.
          </CommerceFormNote>
        ) : null}

        {containsLivePlant ? (
          <fieldset>
            <legend>생화·식물 포함 상품</legend>
            <CommerceFormNote>
              식물은 생물 특성상 계절, 생육 상태, 배송 환경, 수령 지연, 관리
              상태에 따라 상태가 달라질 수 있습니다.
            </CommerceFormNote>
            <CommerceFormNote>
              수령 후 가능한 빠르게 개봉하고 상품별 안내에 따라 통풍, 물주기,
              햇빛 조건을 확인해 주세요. 수령 지연·개봉 후 관리 부주의·생육
              변화에 따른 교환·반품은 제한될 수 있습니다.
            </CommerceFormNote>
          </fieldset>
        ) : null}

        <fieldset className="checkout-check-section">
          <legend>필수 확인</legend>
          <CommerceFormCheckbox>
            <input name="termsAgreed" required type="checkbox" />
            <span>
              <SiteLink href="/terms" target="_blank">
                이용약관
              </SiteLink>
              에 동의합니다.
            </span>
          </CommerceFormCheckbox>
          <CommerceFormCheckbox>
            <input name="privacyAgreed" required type="checkbox" />
            <span>
              <SiteLink href="/privacy" target="_blank">
                개인정보 수집 및 이용
              </SiteLink>
              에 동의합니다.
            </span>
          </CommerceFormCheckbox>
        </fieldset>

        <fieldset className="checkout-check-section">
          <legend>알림 옵션</legend>
          <CommerceFormCheckbox>
            <input defaultChecked name="notifyByKakao" type="checkbox" />
            <span>카카오 알림톡으로 받기</span>
          </CommerceFormCheckbox>
          <CommerceFormCheckbox>
            <input defaultChecked name="notifyByEmail" type="checkbox" />
            <span>이메일로 받기</span>
          </CommerceFormCheckbox>
        </fieldset>

        <CommerceFormActions>
          <SiteActionButton
            disabled={state.status === "submitting"}
            type="submit"
          >
            {state.status === "submitting" ? "접수 중" : submitLabel}
          </SiteActionButton>
          <CommerceFormStatusMessage status={toErrorStatus(state.error)} />
        </CommerceFormActions>
      </form>
    </div>
  );
}

function createCheckoutSignature(input: {
  checkoutMode: CheckoutMode;
  isMadeToOrder: boolean;
  paymentMethod: PaymentMethod;
  productOption: ProductOption;
  productSlug: string;
  quantity: number;
  shippingMethod: ShippingMethod;
}) {
  return JSON.stringify(input);
}

function getOrCreateCheckoutRecovery(signature: string): StoredCheckoutRecovery {
  const stored = readStoredCheckoutRecovery(signature);
  if (stored) {
    return stored;
  }

  const next: StoredCheckoutRecovery = {
    checkoutAttemptId: createBrowserUuid(),
    signature,
    updatedAt: Date.now(),
  };
  writeStoredCheckoutRecovery(next);
  return next;
}

function mergeCheckoutRecovery(
  order: OrderDraftResult,
  recovery: StoredCheckoutRecovery,
): RecoverableOrderDraft {
  return {
    ...order,
    checkoutAttemptId: order.checkoutAttemptId ?? recovery.checkoutAttemptId,
    paymentId: recovery.paymentId,
    recoveryToken: order.recoveryToken ?? recovery.recoveryToken,
    recoveryTokenExpiresAt:
      order.recoveryTokenExpiresAt ?? recovery.recoveryTokenExpiresAt,
  };
}

function readStoredCheckoutRecovery(
  signature: string,
): StoredCheckoutRecovery | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(checkoutRecoveryStorageKey);
  if (!raw) {
    return null;
  }

  try {
    const stored = JSON.parse(raw) as StoredCheckoutRecovery;
    if (
      stored.signature !== signature ||
      !stored.checkoutAttemptId ||
      Date.now() - stored.updatedAt > 1000 * 60 * 60 * 24
    ) {
      return null;
    }

    return stored;
  } catch {
    return null;
  }
}

function persistCheckoutRecovery(
  signature: string,
  order: RecoverableOrderDraft,
) {
  const stored = readStoredCheckoutRecovery(signature);
  const checkoutAttemptId = order.checkoutAttemptId ?? stored?.checkoutAttemptId;

  if (!checkoutAttemptId) {
    return;
  }

  writeStoredCheckoutRecovery({
    checkoutAttemptId,
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    paymentId: order.paymentId ?? stored?.paymentId,
    recoveryToken: order.recoveryToken ?? stored?.recoveryToken,
    recoveryTokenExpiresAt:
      order.recoveryTokenExpiresAt ?? stored?.recoveryTokenExpiresAt,
    signature,
    updatedAt: Date.now(),
  });
}

function clearCheckoutRecovery(signature: string) {
  const stored = readStoredCheckoutRecovery(signature);
  if (stored && typeof window !== "undefined") {
    window.localStorage.removeItem(checkoutRecoveryStorageKey);
  }
}

function writeStoredCheckoutRecovery(recovery: StoredCheckoutRecovery) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    checkoutRecoveryStorageKey,
    JSON.stringify(recovery),
  );
}

function createBrowserUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = char === "x" ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

function isRetryablePaymentStatus(
  status: PortOnePaymentCompleteResult["paymentStatus"] | undefined,
) {
  return status === "failed" || status === "canceled" || status === "expired";
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
    return "방문수령은 결제 후 15일 이내 수령을 원칙으로 합니다.";
  }

  if (isMadeToOrder) {
    return `제작 상품은 결제 후 ${madeToOrderDaysMin ?? 30}~${madeToOrderDaysMax ?? 45}일의 제작 기간이 필요하며, 제작 완료 후 발송됩니다.`;
  }

  return "결제 후 2~5영업일 이내 발송을 원칙으로 합니다.";
}

function productOptionLabel(option: ProductOption) {
  return option === "plant_included" ? "식물 포함" : "식물 제외";
}

function toErrorStatus(message: string | null) {
  return message ? { kind: "error" as const, message } : null;
}

function isSuccessfulPaymentCompletion(result: PortOnePaymentCompleteResult) {
  return (
    result.paymentStatus === "paid" ||
    (result.paymentStatus === "pending" &&
      result.paymentMethod === "portone_virtual_account")
  );
}

function getPaymentCompletionError(result: PortOnePaymentCompleteResult) {
  if (result.paymentStatus === "pending") {
    return "결제가 아직 완료되지 않았습니다. 주문 조회에서 상태를 확인해 주세요.";
  }

  if (result.paymentStatus === "failed") {
    return "결제가 실패했습니다. 결제수단을 확인한 뒤 다시 시도해 주세요.";
  }

  if (result.paymentStatus === "canceled") {
    return "결제가 취소되었습니다.";
  }

  if (result.paymentStatus === "expired") {
    return "입금기한이 만료되었습니다.";
  }

  return "결제가 완료되지 않았습니다. 주문 조회에서 상태를 확인해 주세요.";
}
