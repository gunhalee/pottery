"use client";

import { useFormStatus } from "react-dom";

type MediaVariantRegenerateSubmitProps = {
  disabled?: boolean;
};

export function MediaVariantRegenerateSubmit({
  disabled = false,
}: MediaVariantRegenerateSubmitProps) {
  const { pending } = useFormStatus();
  const blocked = disabled || pending;

  return (
    <button
      aria-busy={pending}
      className="admin-secondary-button"
      data-pending={pending ? "true" : undefined}
      disabled={blocked}
      type="submit"
    >
      {pending ? "재생성 중..." : "variant 재생성"}
    </button>
  );
}
