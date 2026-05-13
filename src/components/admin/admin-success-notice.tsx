"use client";

import { useEffect, useState } from "react";
import {
  AdminActionButton,
  AdminExternalActionLink,
} from "@/components/admin/admin-actions";

type AdminSuccessNoticeProps = {
  description?: string;
  primaryHref?: string | null;
  primaryLabel?: string;
  secondaryHref?: string | null;
  secondaryLabel?: string;
  title: string;
};

export function AdminSuccessNotice({
  description,
  primaryHref,
  primaryLabel = "게시된 페이지 보기",
  secondaryHref,
  secondaryLabel = "미리보기",
  title,
}: AdminSuccessNoticeProps) {
  const [showToast, setShowToast] = useState(true);
  const [copyState, setCopyState] = useState<"copied" | "failed" | "idle">(
    "idle",
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setShowToast(false), 5200);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (copyState === "idle") {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopyState("idle"), 2200);

    return () => window.clearTimeout(timeoutId);
  }, [copyState]);

  async function handleCopy() {
    if (!primaryHref) {
      return;
    }

    try {
      const href = new URL(primaryHref, window.location.origin).toString();
      await navigator.clipboard.writeText(href);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <>
      <div
        aria-live="polite"
        className="admin-success-notice"
        role="status"
      >
        <div className="admin-success-notice-copy">
          <strong>{title}</strong>
          {description ? <p>{description}</p> : null}
        </div>
        <SuccessActions
          copyState={copyState}
          onCopy={handleCopy}
          primaryHref={primaryHref}
          primaryLabel={primaryLabel}
          secondaryHref={secondaryHref}
          secondaryLabel={secondaryLabel}
        />
      </div>
      {showToast ? (
        <div
          aria-live="polite"
          className="admin-success-toast"
          role="status"
        >
          <strong>{title}</strong>
          {description ? <span>{description}</span> : null}
        </div>
      ) : null}
    </>
  );
}

function SuccessActions({
  copyState,
  onCopy,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  copyState: "copied" | "failed" | "idle";
  onCopy: () => void;
  primaryHref?: string | null;
  primaryLabel: string;
  secondaryHref?: string | null;
  secondaryLabel: string;
}) {
  if (!primaryHref && !secondaryHref) {
    return null;
  }

  const copyLabel =
    copyState === "copied"
      ? "링크 복사됨"
      : copyState === "failed"
        ? "복사 실패"
        : "링크 복사";

  return (
    <div className="admin-success-actions">
      {primaryHref ? (
        <>
          <AdminExternalActionLink
            href={primaryHref}
            target="_blank"
            variant="secondary"
          >
            {primaryLabel}
          </AdminExternalActionLink>
          <AdminActionButton
            className="admin-copy-button"
            onClick={onCopy}
          >
            {copyLabel}
          </AdminActionButton>
        </>
      ) : null}
      {secondaryHref ? (
        <AdminExternalActionLink
          href={secondaryHref}
          target="_blank"
          variant="text"
        >
          {secondaryLabel}
        </AdminExternalActionLink>
      ) : null}
    </div>
  );
}
