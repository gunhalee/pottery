"use client";

import type { FormEvent } from "react";
import { useState } from "react";

type GiftRecipientAddressFormProps = {
  expiresAt: string;
  orderNumber: string;
  recipientName: string | null;
  token: string;
};

type FormState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function GiftRecipientAddressForm({
  expiresAt,
  orderNumber,
  recipientName,
  token,
}: GiftRecipientAddressFormProps) {
  const [state, setState] = useState<FormState>({ kind: "idle" });

  async function submitAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: "submitting" });

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/gift-recipient/address", {
      body: JSON.stringify({
        recipientName: String(formData.get("recipientName") ?? ""),
        recipientPhone: String(formData.get("recipientPhone") ?? ""),
        shippingAddress1: String(formData.get("shippingAddress1") ?? ""),
        shippingAddress2: String(formData.get("shippingAddress2") ?? ""),
        shippingMemo: String(formData.get("shippingMemo") ?? ""),
        shippingPostcode: String(formData.get("shippingPostcode") ?? ""),
        token,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload = await response.json().catch(() => ({})) as {
      error?: string;
      message?: string;
    };

    if (!response.ok) {
      setState({
        kind: "error",
        message: payload.error ?? "배송 정보 저장 중 오류가 발생했습니다.",
      });
      return;
    }

    setState({
      kind: "success",
      message: payload.message ?? "배송 정보가 입력되었습니다.",
    });
  }

  if (state.kind === "success") {
    return (
      <div className="gift-address-result">
        <strong>{state.message}</strong>
        <p>주문자에게 입력 완료 안내가 발송됩니다.</p>
      </div>
    );
  }

  return (
    <form className="gift-address-form" onSubmit={submitAddress}>
      <div className="gift-address-head">
        <span>주문번호 {orderNumber}</span>
        <strong>선물 배송 정보를 입력해 주세요.</strong>
        <p>입력 기한: {formatDate(expiresAt)}</p>
      </div>
      <label>
        <span>수령인 이름</span>
        <input
          defaultValue={recipientName ?? ""}
          maxLength={40}
          name="recipientName"
          required
        />
      </label>
      <label>
        <span>수령인 연락처</span>
        <input inputMode="tel" maxLength={30} name="recipientPhone" required />
      </label>
      <label>
        <span>우편번호</span>
        <input maxLength={12} name="shippingPostcode" required />
      </label>
      <label className="gift-address-field-wide">
        <span>주소</span>
        <input maxLength={160} name="shippingAddress1" required />
      </label>
      <label className="gift-address-field-wide">
        <span>상세 주소</span>
        <input maxLength={160} name="shippingAddress2" />
      </label>
      <label className="gift-address-field-wide">
        <span>배송 요청사항</span>
        <textarea maxLength={120} name="shippingMemo" />
      </label>
      <p className="gift-address-note">
        입력한 정보는 선물 배송과 관련 문의 응대 목적으로만 사용됩니다.
      </p>
      <button className="button-primary" disabled={state.kind === "submitting"}>
        {state.kind === "submitting" ? "저장 중" : "배송 정보 저장"}
      </button>
      {state.kind === "error" ? (
        <p className="checkout-error" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
