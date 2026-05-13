"use client";

import { useFormStatus } from "react-dom";
import { AdminActionButton } from "@/components/admin/admin-actions";

type MediaVariantRegenerateSubmitProps = {
  disabled?: boolean;
};

export function MediaVariantRegenerateSubmit({
  disabled = false,
}: MediaVariantRegenerateSubmitProps) {
  const { pending } = useFormStatus();
  const blocked = disabled || pending;

  return (
    <AdminActionButton
      aria-busy={pending}
      data-pending={pending ? "true" : undefined}
      disabled={blocked}
      type="submit"
    >
      {pending ? "재생성 중..." : "variant 재생성"}
    </AdminActionButton>
  );
}
