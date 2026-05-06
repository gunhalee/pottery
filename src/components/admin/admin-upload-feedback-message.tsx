"use client";

import type { AdminUploadFeedback } from "@/lib/admin/upload-feedback";

type AdminUploadFeedbackMessageProps = {
  feedback: AdminUploadFeedback;
};

export function AdminUploadFeedbackMessage({
  feedback,
}: AdminUploadFeedbackMessageProps) {
  return (
    <div
      aria-live={feedback.tone === "error" ? "assertive" : "polite"}
      className={`admin-upload-feedback admin-upload-feedback-${feedback.tone}`}
      role={feedback.tone === "error" ? "alert" : "status"}
    >
      <strong>{feedback.title}</strong>
      <p>{feedback.description}</p>
      {feedback.action ? <span>{feedback.action}</span> : null}
      {feedback.detail ? <code>세부 오류: {feedback.detail}</code> : null}
    </div>
  );
}
