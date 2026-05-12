"use client";

import type { FormEvent } from "react";
import { useState } from "react";

type ConsentState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export function ClassReviewConsentForm() {
  const [state, setState] = useState<ConsentState>({ kind: "idle" });

  async function submitConsent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: "submitting" });

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/class-review-consent", {
      body: JSON.stringify({
        classTitle: String(formData.get("classTitle") ?? ""),
        contact: String(formData.get("contact") ?? ""),
        displayName: String(formData.get("displayName") ?? ""),
        participantName: String(formData.get("participantName") ?? ""),
        siteSnsConsent: Boolean(formData.get("siteSnsConsent")),
        workPhotoConsent: Boolean(formData.get("workPhotoConsent")),
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
        message: payload.error ?? "동의 접수 중 오류가 발생했습니다.",
      });
      return;
    }

    event.currentTarget.reset();
    setState({
      kind: "success",
      message: payload.message ?? "선택 동의가 접수되었습니다.",
    });
  }

  return (
    <form className="class-consent-form" onSubmit={submitConsent}>
      <div className="class-consent-head">
        <span>선택 동의</span>
        <strong>클래스 후기와 작업물 사진 게시 동의</strong>
        <p>동의하지 않아도 클래스 참여에는 불이익이 없습니다.</p>
      </div>
      <label>
        <span>참여자 이름</span>
        <input maxLength={40} name="participantName" required />
      </label>
      <label>
        <span>연락처 또는 이메일</span>
        <input maxLength={120} name="contact" />
      </label>
      <label>
        <span>클래스명</span>
        <input maxLength={80} name="classTitle" />
      </label>
      <label>
        <span>게시 표시명</span>
        <input maxLength={40} name="displayName" placeholder="닉네임 또는 이니셜" />
      </label>
      <label className="class-consent-check">
        <input name="siteSnsConsent" type="checkbox" />
        <span>후기와 작업물 사진을 사이트 또는 SNS에 게시하는 데 동의합니다.</span>
      </label>
      <label className="class-consent-check">
        <input name="workPhotoConsent" type="checkbox" />
        <span>작업물 사진을 홍보 콘텐츠에 활용하는 데 동의합니다.</span>
      </label>
      <p className="class-consent-note">
        이름은 닉네임, 이니셜 또는 일부 마스킹된 이름으로 표시되며 얼굴이
        식별되는 사진은 게시하지 않습니다. 동의는 언제든 철회할 수 있습니다.
      </p>
      <button className="button-primary" disabled={state.kind === "submitting"}>
        {state.kind === "submitting" ? "접수 중" : "선택 동의 접수"}
      </button>
      {state.kind === "success" || state.kind === "error" ? (
        <p
          className={state.kind === "error" ? "checkout-error" : "class-consent-status"}
          role={state.kind === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
