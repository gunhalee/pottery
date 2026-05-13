import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react";
import { SiteActionButton, SiteStatusMessage } from "@/components/site/actions";

export type ReviewFormStatus = {
  kind: "error" | "success";
  message: string;
} | null;

type ReviewFormFieldProps = LabelHTMLAttributes<HTMLLabelElement> & {
  honeypot?: boolean;
  wide?: boolean;
};

type ReviewFormActionsProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  status: ReviewFormStatus;
};

type ReviewFormSubmitButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    idleLabel: ReactNode;
    pendingLabel: ReactNode;
    submitting: boolean;
  };

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function ReviewFormField({
  className,
  honeypot = false,
  wide = false,
  ...props
}: ReviewFormFieldProps) {
  return (
    <label
      {...props}
      className={cx(
        "product-feedback-field",
        wide && "product-feedback-field-wide",
        honeypot && "product-feedback-honeypot",
        className,
      )}
    />
  );
}

export function ReviewFormConsent({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className={cx("product-feedback-consent", className)}
    />
  );
}

export function ReviewFormHelp({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span {...props} className={cx("product-feedback-help", className)} />
  );
}

export function ReviewFormActions({
  children,
  className,
  status,
  ...props
}: ReviewFormActionsProps) {
  return (
    <div {...props} className={cx("product-feedback-form-actions", className)}>
      {status ? (
        <SiteStatusMessage
          className={cx(
            "product-feedback-form-status",
            `product-feedback-form-status-${status.kind}`,
          )}
          tone={status.kind}
        >
          {status.message}
        </SiteStatusMessage>
      ) : null}
      {children}
    </div>
  );
}

export function ReviewFormSubmitButton({
  className,
  disabled,
  idleLabel,
  pendingLabel,
  submitting,
  ...props
}: ReviewFormSubmitButtonProps) {
  return (
    <SiteActionButton
      {...props}
      className={cx("product-feedback-submit", className)}
      disabled={disabled || submitting}
      type="submit"
      variant="quiet"
    >
      {submitting ? pendingLabel : idleLabel}
    </SiteActionButton>
  );
}

export function ReviewEmptyState({ children }: { children: ReactNode }) {
  return <p className="product-empty-state">{children}</p>;
}
