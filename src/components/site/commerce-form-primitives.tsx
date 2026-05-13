import type {
  HTMLAttributes,
  Key,
  LabelHTMLAttributes,
  ReactNode,
} from "react";
import { SiteStatusMessage } from "@/components/site/actions";

type CommerceFormScope = "checkout" | "gift-address" | "order-refund";

type CommerceFormFieldProps = LabelHTMLAttributes<HTMLLabelElement> & {
  scope?: CommerceFormScope;
  wide?: boolean;
};

type CommerceFormNoteProps = HTMLAttributes<HTMLParagraphElement> & {
  scope?: Extract<CommerceFormScope, "checkout" | "gift-address">;
};

type CommerceFormActionsProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

type CommerceQuantityStepperProps = {
  ariaLabel: string;
  className: string;
  decreaseLabel: string;
  increaseLabel: string;
  inputLabel: string;
  max: number;
  min?: number;
  onChange: (value: number) => void;
  value: number;
};

type CommerceSummaryItem = {
  key?: Key;
  label: ReactNode;
  value: ReactNode;
};

type CommerceSummaryListProps = HTMLAttributes<HTMLDListElement> & {
  items: CommerceSummaryItem[];
};

export type CommerceFormStatus = {
  kind: "error" | "success";
  message: string;
} | null;

type CommerceFormStatusMessageProps = HTMLAttributes<HTMLParagraphElement> & {
  errorClassName?: string;
  status: CommerceFormStatus;
  successClassName?: string;
};

const wideFieldClassName = {
  checkout: "checkout-field-wide",
  "gift-address": "gift-address-field-wide",
  "order-refund": "order-refund-field-wide",
} satisfies Record<CommerceFormScope, string>;

const noteClassName = {
  checkout: "checkout-note",
  "gift-address": "gift-address-note",
} satisfies Record<NonNullable<CommerceFormNoteProps["scope"]>, string>;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function CommerceFormField({
  className,
  scope = "checkout",
  wide = false,
  ...props
}: CommerceFormFieldProps) {
  return (
    <label
      {...props}
      className={cx(wide && wideFieldClassName[scope], className)}
    />
  );
}

export function CommerceFormCheckbox({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label {...props} className={cx("checkout-checkbox", className)} />
  );
}

export function CommerceFormNote({
  className,
  scope = "checkout",
  ...props
}: CommerceFormNoteProps) {
  return <p {...props} className={cx(noteClassName[scope], className)} />;
}

export function CommerceFormActions({
  className,
  ...props
}: CommerceFormActionsProps) {
  return <div {...props} className={cx("checkout-actions", className)} />;
}

export function CommerceQuantityStepper({
  ariaLabel,
  className,
  decreaseLabel,
  increaseLabel,
  inputLabel,
  max,
  min = 1,
  onChange,
  value,
}: CommerceQuantityStepperProps) {
  return (
    <div className={className} role="group" aria-label={ariaLabel}>
      <button
        aria-label={decreaseLabel}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        type="button"
      >
        -
      </button>
      <input
        aria-label={inputLabel}
        inputMode="numeric"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        type="number"
        value={value}
      />
      <button
        aria-label={increaseLabel}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        type="button"
      >
        +
      </button>
    </div>
  );
}

export function CommerceSummaryList({
  className,
  items,
  ...props
}: CommerceSummaryListProps) {
  return (
    <dl {...props} className={className}>
      {items.map((item, index) => (
        <div key={item.key ?? index}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CommerceFormStatusMessage({
  className,
  errorClassName = "checkout-error",
  status,
  successClassName,
  ...props
}: CommerceFormStatusMessageProps) {
  if (!status) {
    return null;
  }

  return (
    <SiteStatusMessage
      {...props}
      className={cx(
        status.kind === "error" && errorClassName,
        status.kind === "success" && successClassName,
        className,
      )}
      tone={status.kind}
    >
      {status.message}
    </SiteStatusMessage>
  );
}
