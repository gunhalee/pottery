"use client";

import { useState, type FormEvent } from "react";
import { SiteActionButton } from "@/components/site/actions";
import {
  ReviewFormActions,
  ReviewFormConsent,
  ReviewFormField,
  ReviewFormHelp,
  ReviewFormSubmitButton,
  type ReviewFormStatus,
} from "@/components/site/review-form-primitives";
import { submitReviewForm } from "@/components/site/review-form-submit";
import type { ClassReviewSession } from "./class-review-types";

export function ClassReviewFormPanel({
  classSessions,
}: {
  classSessions: ClassReviewSession[];
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<ReviewFormStatus>(null);

  const toggleForm = () => {
    setIsFormOpen((current) => !current);
    setStatus(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;
    setIsSubmitting(true);
    setStatus(null);

    const nextStatus = await submitReviewForm({
      endpoint: "/api/class-reviews",
      form,
    });

    setStatus(nextStatus);
    setIsSubmitting(false);
  };

  return (
    <>
      <div className="product-feedback-head class-review-head">
        <div className="product-feedback-title">
          <h2>후기</h2>
        </div>
        <SiteActionButton onClick={toggleForm} variant="quiet">
          후기 작성
        </SiteActionButton>
      </div>
      {isFormOpen ? (
        <ClassReviewForm
          classSessions={classSessions}
          onSubmit={handleSubmit}
          status={status}
          submitting={isSubmitting}
        />
      ) : null}
    </>
  );
}

function ClassReviewForm({
  classSessions,
  onSubmit,
  status,
  submitting,
}: {
  classSessions: ClassReviewSession[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  status: ReviewFormStatus;
  submitting: boolean;
}) {
  return (
    <form className="product-feedback-form class-review-form" onSubmit={onSubmit}>
      <ReviewFormField honeypot>
        웹사이트
        <input autoComplete="off" name="website" tabIndex={-1} type="text" />
      </ReviewFormField>
      <ReviewFormField>
        이름
        <input maxLength={40} name="participantName" required type="text" />
      </ReviewFormField>
      <ReviewFormField>
        연락처 또는 이메일
        <input maxLength={120} name="contact" type="text" />
      </ReviewFormField>
      <ReviewFormField>
        클래스명
        <input maxLength={80} name="classTitle" type="text" />
      </ReviewFormField>
      {classSessions.length > 0 ? (
        <ReviewFormField>
          클래스 회차
          <select name="classSessionId" defaultValue="">
            <option value="">선택하지 않음</option>
            {classSessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.title}
                {session.dateLabel || session.sessionDate
                  ? ` · ${session.dateLabel || session.sessionDate}`
                  : ""}
              </option>
            ))}
          </select>
        </ReviewFormField>
      ) : null}
      <ReviewFormField wide>
        내용
        <textarea maxLength={1200} minLength={5} name="body" required />
      </ReviewFormField>
      <ReviewFormField wide>
        사진
        <input
          accept="image/jpeg,image/png,image/webp"
          multiple
          name="photos"
          type="file"
        />
        <ReviewFormHelp>jpg, png, webp / 최대 5장 / 장당 20MB 이하</ReviewFormHelp>
      </ReviewFormField>
      <ReviewFormConsent>
        <input name="marketingConsent" type="checkbox" />
        <span>
          [선택] 작성한 후기와 사진을 콘세포트의 SNS, 홍보 콘텐츠에 사용할 수
          있음에 동의합니다.
        </span>
      </ReviewFormConsent>
      <ReviewFormActions status={status}>
        <ReviewFormSubmitButton
          idleLabel="접수하기"
          pendingLabel="접수 중"
          submitting={submitting}
        />
      </ReviewFormActions>
    </form>
  );
}
