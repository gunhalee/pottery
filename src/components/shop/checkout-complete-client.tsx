"use client";

import { useEffect, useState } from "react";
import {
  SiteActionLink,
} from "@/components/site/actions";
import {
  CommerceFormStatusMessage,
  CommerceSummaryList,
} from "@/components/site/commerce-form-primitives";
import type { PortOnePaymentCompleteResult } from "@/lib/payments/portone-model";

type CheckoutCompleteClientProps = {
  errorCode?: string;
  errorMessage?: string;
  orderId?: string;
  paymentId?: string;
};

type CompletionState =
  | {
      error: null;
      result: null;
      status: "idle" | "verifying";
    }
  | {
      error: string;
      result: null;
      status: "error";
    }
  | {
      error: null;
      result: PortOnePaymentCompleteResult;
      status: "success";
    };

type CompletionRecoveryResponse = {
  action: string;
  message: string;
  order?: {
    depositAccount?: PortOnePaymentCompleteResult["depositAccount"];
    depositDueAt?: string | null;
    orderId: string;
    orderNumber: string;
    paymentMethod?: PortOnePaymentCompleteResult["paymentMethod"];
    paymentStatus: PortOnePaymentCompleteResult["paymentStatus"];
    total: number;
  };
  payment?: {
    paymentId?: string;
  } | null;
};

export function CheckoutCompleteClient({
  errorCode,
  errorMessage,
  orderId,
  paymentId,
}: CheckoutCompleteClientProps) {
  const [state, setState] = useState<CompletionState>(() =>
    getInitialCompletionState({
      errorCode,
      errorMessage,
      orderId,
      paymentId,
    }),
  );

  useEffect(() => {
    if (errorCode || !paymentId) {
      return;
    }

    const controller = new AbortController();

    async function verifyPayment() {
      try {
        const response = await fetch("/api/payments/portone/complete", {
          body: JSON.stringify({
            orderId,
            paymentId,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => ({}))) as
          | (PortOnePaymentCompleteResult & { error?: never })
          | { error?: string };

        if (!response.ok || !("orderNumber" in result)) {
          const recovered = await recoverPaymentCompletion({
            orderId,
            paymentId,
            signal: controller.signal,
          });

          if (recovered?.result) {
            setState({
              error: null,
              result: recovered.result,
              status: "success",
            });
            return;
          }

          throw new Error(
            recovered?.message ?? result.error ?? "결제 검증에 실패했습니다.",
          );
        }

        if (!isSuccessfulPaymentCompletion(result)) {
          throw new Error(getPaymentCompletionError(result));
        }

        setState({
          error: null,
          result,
          status: "success",
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setState({
          error:
            error instanceof Error
              ? error.message
              : "결제 검증 중 오류가 발생했습니다.",
          result: null,
          status: "error",
        });
      }
    }

    verifyPayment();

    return () => {
      controller.abort();
    };
  }, [errorCode, orderId, paymentId]);

  if (state.status === "success") {
    const result = state.result;
    const isVirtualAccount =
      result.paymentMethod === "portone_virtual_account" &&
      result.paymentStatus === "pending";

    return (
      <div
        className={
          isVirtualAccount
            ? "checkout-result checkout-bank-result"
            : "checkout-result"
        }
      >
        <span>{isVirtualAccount ? "입금대기" : "주문 완료"}</span>
        <strong>{result.orderNumber}</strong>
        {isVirtualAccount ? (
          <>
            <p>
              가상계좌가 발급되었습니다. 입금기한 내 입금해 주세요. 입금 확인
              후 주문이 확정되고 배송 준비가 시작됩니다.
            </p>
            <CommerceSummaryList
              items={[
                {
                  label: "입금 계좌",
                  value: result.depositAccount
                    ? `${result.depositAccount.bankName} ${result.depositAccount.accountNumber} / ${result.depositAccount.accountHolder}`
                    : "주문 조회에서 확인해 주세요.",
                },
                {
                  label: "입금 기한",
                  value: formatDateTime(result.depositDueAt),
                },
                {
                  label: "입금 금액",
                  value: formatMoney(result.total),
                },
              ]}
            />
          </>
        ) : (
          <p>
            결제가 완료되어 주문이 접수되었습니다. 주문 및 배송 안내는 이메일과
            카카오 알림톡으로 발송됩니다.
          </p>
        )}
        <SiteActionLink href="/order/lookup">
          주문 조회하기
        </SiteActionLink>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="checkout-result">
        <span>결제 확인</span>
        <strong>확인이 필요합니다</strong>
        <CommerceFormStatusMessage
          status={{ kind: "error", message: state.error }}
        />
        <SiteActionLink href="/order/lookup">
          주문 조회하기
        </SiteActionLink>
      </div>
    );
  }

  return (
    <div className="checkout-result">
      <span>결제 확인</span>
      <strong>결제 정보를 확인하고 있습니다</strong>
      <p>브라우저를 닫지 말고 잠시만 기다려 주세요.</p>
    </div>
  );
}

async function recoverPaymentCompletion({
  orderId,
  paymentId,
  signal,
}: {
  orderId?: string;
  paymentId?: string;
  signal: AbortSignal;
}): Promise<{ message?: string; result?: PortOnePaymentCompleteResult } | null> {
  if (!orderId || !paymentId) {
    return null;
  }

  try {
    const response = await fetch("/api/checkout/recover", {
      body: JSON.stringify({
        orderId,
        paymentId,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      signal,
    });
    const recovery = (await response.json().catch(() => null)) as
      | CompletionRecoveryResponse
      | null;

    if (!recovery) {
      return null;
    }

    if (
      recovery.order &&
      (recovery.order.paymentStatus === "paid" ||
        (recovery.order.paymentStatus === "pending" &&
          recovery.order.paymentMethod === "portone_virtual_account"))
    ) {
      return {
        result: {
          depositAccount: recovery.order.depositAccount,
          depositDueAt: recovery.order.depositDueAt,
          orderId: recovery.order.orderId,
          orderNumber: recovery.order.orderNumber,
          paymentId: recovery.payment?.paymentId ?? paymentId,
          paymentMethod: recovery.order.paymentMethod,
          paymentStatus: recovery.order.paymentStatus,
          total: recovery.order.total,
        },
      };
    }

    return {
      message: recovery.message,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    return null;
  }
}

function getInitialCompletionState({
  errorCode,
  errorMessage,
  paymentId,
}: CheckoutCompleteClientProps): CompletionState {
  if (errorCode) {
    return {
      error: errorMessage ?? "결제가 완료되지 않았습니다.",
      result: null,
      status: "error",
    };
  }

  if (!paymentId) {
    return {
      error: "결제 완료 정보를 찾지 못했습니다.",
      result: null,
      status: "error",
    };
  }

  return {
    error: null,
    result: null,
    status: "verifying",
  };
}

function formatDateTime(value: string | null | undefined) {
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

function formatMoney(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
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
